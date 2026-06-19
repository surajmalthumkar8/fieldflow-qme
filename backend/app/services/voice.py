"""Female-voice TTS for the receptionist.

Target: Kokoro (natural local US female voice). Until the Kokoro model files are
installed, we fall back to the macOS `say` voice (Samantha) so /voice works out of
the box. Both return WAV bytes. Selection is automatic ("auto") or forced via
TTS_PROVIDER. See docs/research_findings.md for the Kokoro install path.
"""
import asyncio
import shutil
import tempfile
from pathlib import Path

from ..core.config import get_settings

settings = get_settings()

# Lazy Kokoro pipeline (only built if the package + voices are present).
_kokoro = None
_kokoro_tried = False


def _try_load_kokoro():
    global _kokoro, _kokoro_tried
    if _kokoro_tried:
        return _kokoro
    _kokoro_tried = True
    try:
        from kokoro_onnx import Kokoro  # type: ignore

        # Standard Kokoro model file names; present only if the operator downloaded them.
        # app/services/voice.py -> parents[2] == backend/ ; voices live in backend/voices/
        model = Path(__file__).resolve().parents[2] / "voices" / "kokoro-v1.0.onnx"
        voices = Path(__file__).resolve().parents[2] / "voices" / "voices-v1.0.bin"
        if model.exists() and voices.exists():
            _kokoro = Kokoro(str(model), str(voices))
    except Exception:
        _kokoro = None
    return _kokoro


def kokoro_available() -> bool:
    return _try_load_kokoro() is not None


def say_available() -> bool:
    return shutil.which("say") is not None


def active_provider() -> str:
    forced = settings.tts_provider.lower()
    if forced == "kokoro":
        return "kokoro" if kokoro_available() else "unavailable"
    if forced == "say":
        return "say" if say_available() else "unavailable"
    # auto
    if kokoro_available():
        return "kokoro"
    if say_available():
        return "say"
    return "unavailable"


async def synthesize(text: str, voice: str | None = None) -> tuple[bytes, str]:
    """Return (wav_bytes, provider_used)."""
    provider = active_provider()
    if provider == "kokoro":
        return await _synth_kokoro(text, voice or settings.tts_voice), "kokoro"
    if provider == "say":
        return await _synth_say(text, voice or settings.say_voice), "say"
    raise RuntimeError("No TTS provider available (install Kokoro or run on macOS).")


async def _synth_kokoro(text: str, voice: str) -> bytes:
    import io

    import soundfile as sf  # type: ignore

    kokoro = _try_load_kokoro()
    samples, sample_rate = await asyncio.to_thread(kokoro.create, text, voice=voice, speed=1.0, lang="en-us")
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    return buf.getvalue()


async def _synth_say(text: str, voice: str) -> bytes:
    """macOS `say` → WAV (LEI16 @ 22.05kHz), browser-friendly."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        out_path = tmp.name
    try:
        proc = await asyncio.create_subprocess_exec(
            "say", "-v", voice, "-o", out_path,
            "--file-format=WAVE", "--data-format=LEI16@22050", text,
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"say failed: {err.decode(errors='ignore')}")
        return Path(out_path).read_bytes()
    finally:
        Path(out_path).unlink(missing_ok=True)
