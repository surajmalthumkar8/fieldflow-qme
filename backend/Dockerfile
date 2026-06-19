# Techages AI — FastAPI AI/voice service
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps: espeak-ng for the Kokoro phonemizer path (optional voice upgrade).
RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000
# Liveness backstop (process up). Orchestrators should ALSO probe /health/ready for
# traffic routing — it 503s when the DB is down so the LB drains this instance.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8000/health/live || exit 1

# No --reload in production. Scale horizontally (more replicas behind a load
# balancer), not more workers per box — the heavy LLM work is on the Ollama tier.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
