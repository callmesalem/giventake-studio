# Video Agent Production Worker

## Purpose

This VPS-only service turns approved, signed render jobs into branded video export manifests. It owns FFmpeg, FFprobe, the local SQLite queue, raw fixture media, and later provider credentials. The public GivenTake site does not expose this service or its secrets.

## Before installation

- Install Docker Engine and the Docker Compose plugin on Sami's VPS.
- Keep the Studio route local-only. Authentication and Postgres persistence are still required before the public app may submit jobs.
- Generate a worker secret with `openssl rand -hex 32`. Store it only in the VPS `.env` file and the future server-side Studio environment. Never use a `VITE_` variable.
- Leave `STUDIO_OUTBOUND_KILL_SWITCH=true`. Health checks work in this state; render jobs are rejected by design.

## Install

```bash
cd /opt/giventake-studio/services/video-worker
cp .env.example .env
nano .env
docker compose up --build -d
docker compose ps
curl http://127.0.0.1:8788/healthz
```

Expected health response:

```json
{"status":"ok","queue":{}}
```

The Compose file binds the port to `127.0.0.1`. Do not open port `8788` to the internet. When the authenticated control plane is ready, route traffic through a private TLS reverse proxy with an IP allowlist.

## Configuration

| Variable | Required | Safe initial value | Meaning |
| --- | --- | --- | --- |
| `STUDIO_WORKER_SHARED_SECRET` | Yes | generated 64-character hex value | HMAC key shared only with the server-side Studio control plane |
| `STUDIO_OUTBOUND_KILL_SWITCH` | Yes | `true` | rejects new render jobs while retaining health checks |
| `STUDIO_VIDEO_PROVIDER` | Yes | `fixture` | the only provider enabled in this release |
| `STUDIO_WORKER_PROVIDER_RATES_JSON` | Yes | `{"fixture":{"fixture":0}}` | cents-per-second reservation policy |
| `STUDIO_WORKER_DATA_DIR` | No | `/var/lib/giventake-video-worker` | SQLite database, raw fixture clips, and exports |
| `STUDIO_WORKER_LEASE_MS` | No | `300000` | abandoned-job recovery window |
| `STUDIO_WORKER_POLL_INTERVAL_MS` | No | `1000` | worker loop cadence |

Real provider activation is intentionally unavailable in this release. The process exits if `STUDIO_VIDEO_PROVIDER` is not `fixture`, preventing accidental spend before the Sora or local-provider adapter is deployed with pricing, storage, and monitoring.

## Backup and recovery

The Docker volume contains `worker.db`, fixture source clips, export sidecar files, and completed local exports. Stop the service before copying the database:

```bash
docker compose stop
docker run --rm -v video-worker-data:/data -v "$PWD":/backup alpine tar czf /backup/video-worker-backup.tgz -C /data .
docker compose start
```

Jobs with an expired lease return to the queue. Terminal failures and QA failures remain in SQLite with sanitized categories and are not retried automatically. Inspect queue health with the localhost endpoint; do not copy raw provider responses or secrets into support tickets.

## Controlled activation sequence

1. Confirm the authenticated application control plane and PostgreSQL tenant isolation are deployed.
2. Set the same worker secret in the server-side application environment.
3. Submit one fixture job with a test tenant and a budget of at least one cent.
4. Temporarily set `STUDIO_OUTBOUND_KILL_SWITCH=false` only for that controlled test, then set it back to `true`.
5. Confirm the job records three export manifests and a `qa_passed` attempt.
6. Do not enable a paid provider, social publishing, or ad spend until Release C provider monitoring and operator approval are complete.
