# Deployment, Health & Scaling

How Techaegis AI runs in production: health-checked, self-healing, and scalable per tier.

## Why the local dev site slows over time (and prod won't)

Running `next dev` for hours accumulates in-memory compile state (hot-reload module
graphs, source maps, watchers) and grows the Node heap → it feels sluggish until you
restart. **This is a dev-mode artifact.** Production runs `next build && next start`
(or the container here), which serves pre-compiled, minified assets with no watchers
or recompilation — memory stays flat. The backend already runs without `--reload`.

So the "restart to make it fast again" behavior disappears in production. What we
*do* still want is health-checked, self-healing instances — covered below.

## The four tiers

| Tier | What | State | Scale by |
|------|------|-------|----------|
| **Frontend** (Next.js) | UI + thin API/proxy routes | stateless | more replicas behind a load balancer |
| **Backend** (FastAPI) | auth, chat orchestration, scheduling, analytics | stateless (JWT + DB) | more replicas |
| **Postgres** (+pgvector) | all data + sessions + vectors | the source of truth | vertical first; managed read replicas later |
| **Ollama** (LLM) | the heavy AI inference (qwen2.5:1.5b) | model files | its own GPU box/pool; scale separately |

Because the app servers are **stateless** (every session is a JWT + rows in Postgres),
any frontend/backend instance can be killed and replaced with **zero user impact** —
this is what makes auto-restart and rolling deploys safe.

## Health checks (already implemented)

Backend (`backend/app/routers/health.py`):
- `GET /health/live` — **liveness**: is the process up? No dependency checks, so a
  flaky dependency never causes the orchestrator to kill a healthy process.
- `GET /health/ready` — **readiness**: returns **503** when Postgres is unreachable,
  so the load balancer **drains** that instance until it recovers (no failed requests).
- `GET /health` — full status (DB + Ollama + TTS), used by the in-app "AI online" badge.

Frontend: `GET /api/ai/health` proxies backend health for the UI badge.

## Self-healing — local (Docker Compose, in this repo)

`docker-compose.yml` already encodes the production pattern:
- `restart: unless-stopped` on db, backend, frontend, ollama → **auto-restart on crash/OOM**.
- `healthcheck:` on every service → Docker marks unhealthy containers.
- `depends_on: condition: service_healthy` → frontend waits for a **ready** backend,
  backend waits for a **ready** DB.

```bash
docker compose up --build          # uses your host Ollama (no model re-download)
docker compose --profile ollama up # also run Ollama in a container
docker compose up -d --build
```

## Self-healing — cloud

Pick one; both give exactly the "watch health, replace the unhealthy instance" behavior:

**Option A — AWS ECS / Fargate (simplest, fits AWS Activate credits)**
- Each service = a Task Definition with a **container health check** (`/health/live`).
- An **Application Load Balancer** target group health-checks `/health/ready`; unhealthy
  targets are drained and the service **launches a replacement task** automatically.
- **Service Auto Scaling** on CPU / ALB request latency adds/removes tasks.
- Postgres → **RDS** (managed backups/failover). Ollama → a GPU EC2 instance (or a
  managed inference endpoint) registered as its own service.

**Option B — Kubernetes**
- `livenessProbe: /health/live` (restarts a wedged pod) + `readinessProbe: /health/ready`
  (keeps traffic off until deps are OK).
- **HorizontalPodAutoscaler** scales replicas on CPU/latency; rolling deploys replace pods.
- Postgres via a managed service or operator; Ollama as a separate GPU node pool.

## Memory-leak / degradation guardrails

Even though prod is far more stable than dev, set a ceiling so a slow leak self-heals:
- **Container memory limits** → the orchestrator recycles an over-limit instance
  (rolling, zero downtime). ECS: task memory hard limit. k8s: `resources.limits.memory`.
- Simple VM setup: **PM2** with `max_memory_restart: '600M'`, or systemd `MemoryMax=` +
  `Restart=always`.
- Roll instances on a schedule (e.g. nightly) if you ever see creep — cheap insurance.

## Scaling guidance (per tier)

- **Frontend/Backend**: horizontal — they're stateless and cheap. Start with 2 replicas
  each (no single point of failure), autoscale on load.
- **Postgres**: vertical first (it's tiny today); add a read replica when analytics
  queries grow. Connection pooling is already configured (`pool_pre_ping`, warm pool).
- **Ollama is the real cost/scaling lever**, not the web app. It's single-generation
  per model instance. For concurrency: run multiple Ollama replicas behind a queue/LB,
  on GPU. Keep the model resident (we pin `num_ctx` + `keep_alive` so it never reloads).
  Cheapest path: one budget GPU box; scale out only when concurrent chats demand it.

## Pre-production checklist

- [ ] Set real secrets via env (rotate `JWT_SECRET`, SMTP creds, DB password) — never commit `.env`.
- [ ] `APP_URL` set to the public URL (password-set links in email).
- [ ] Postgres on a managed service with automated backups.
- [ ] LB health checks → `/health/ready` (backend), `/login` (frontend).
- [ ] Memory limits + auto-restart configured on every service.
- [ ] Ollama on its own (GPU) host with `/api/tags` health check.
