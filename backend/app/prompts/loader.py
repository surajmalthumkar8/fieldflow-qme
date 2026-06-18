"""Loads prompts from the YAML files in this folder.

EDIT the .yaml files to change prompts — no code changes. Files are re-read on
every call (not cached), so edits take effect on the next request without a restart.
Placeholders in persona.yaml use {{double_braces}} so they never clash with the
literal { } in the JSON response contract.
"""
from pathlib import Path

import yaml

PROMPTS_DIR = Path(__file__).resolve().parent


def _load(name: str) -> dict:
    return yaml.safe_load((PROMPTS_DIR / name).read_text()) or {}


def persona_name() -> str:
    return _load("persona.yaml").get("name", "Elara")


def qualifying_fields() -> list[str]:
    return _load("persona.yaml").get("qualifying_fields", [])


def receptionist_system_prompt(business_name: str, service_area: str, context: str = "") -> str:
    p = _load("persona.yaml")
    area = service_area or "the local area"
    kb_block = ""
    if context:
        kb_block = p.get("kb_template", "").replace("{{context}}", context)
    return (
        p.get("system", "")
        .replace("{{persona}}", p.get("name", "Elara"))
        .replace("{{business}}", business_name)
        .replace("{{area}}", area)
        .replace("{{kb_block}}", kb_block)
        .strip()
    )


def qualify_system() -> str:
    return _load("qualify.yaml").get("system", "").strip()


def summarize_system() -> str:
    return _load("summarize.yaml").get("system", "").strip()
