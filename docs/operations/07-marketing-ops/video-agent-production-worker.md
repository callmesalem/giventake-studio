# Video Agent Production Worker

## Purpose

This VPS-only service accepts a persisted, signed Studio fixture job and produces three branded export manifests. It owns FFmpeg, FFprobe, the local SQLite queue, raw fixture media, and worker-only secrets. The public GivenTake site and browser clients do not access it.

The worker remains fixture-only. It does not accept paid-provider, social publishing, ad-spend, avatar, UGC, or object-storage behavior in this release.

## Installation and network boundary

1. Install Docker Engine and the Docker Compose plugin on Sami's VPS.
2. Generate one secret with `openssl rand -hex 32`. Set the same `STUDIO_WORKER_SHARED_SECRET` in the VPS `.env` and the server-side Studio environment. Never use a `VITE_` variable or paste it into an issue.
3. Keep the service private. The Compose service binds its port to localhost; preserve that binding. If the application is on another host, use a private TLS reverse proxy with an IP allowlist. Do not expose port `8788` to the internet.
4. Install with outbound work disabled:

   ```bash
   cd /opt/giventake-studio/services/video-worker
   cp .env.example .env
   nano .env
   docker compose up --build -d
   docker compose ps
   curl http://127.0.0.1:8788/healthz
   ```

Expected health response is `{"status":"ok","queue":{}}` while idle.

## Configuration

| Variable | Safe initial value | Meaning |
| --- | --- | --- |
| `STUDIO_WORKER_SHARED_SECRET` | generated 64-character hex value | HMAC key shared only with the server-side Studio control plane |
| `STUDIO_OUTBOUND_KILL_SWITCH` | `true` | Rejects jobs while retaining health checks |
| `STUDIO_VIDEO_PROVIDER` | `fixture` | Only allowed provider in this release |
| `STUDIO_WORKER_PROVIDER_RATES_JSON` | `{"fixture":{"fixture":0}}` | Cost reservation policy |
| `STUDIO_WORKER_DATA_DIR` | `/var/lib/giventake-video-worker` | SQLite database, source media, and exports |
| `STUDIO_WORKER_OUTPUT_DIR` | `/var/lib/giventake-video-worker/outputs` | Fixture export output path |
| `STUDIO_WORKER_LEASE_MS` | `300000` | Abandoned-job recovery window |
| `STUDIO_WORKER_POLL_INTERVAL_MS` | `1000` | Queue poll interval |

Keep `STUDIO_OUTBOUND_KILL_SWITCH=true` until the Studio bootstrap and the controlled fixture sequence in [the Studio guide](video-agent-studio.md) are complete. The worker rejects a job even if the application control plane is accidentally enabled.

## Observed fixture run

1. Verify the worker is healthy, uses `fixture`, and shares the current HMAC secret with the application.
2. With both kill switches initially true, authenticate to Studio as the provisioned operator and create/approve a single test campaign.
3. Temporarily set both kill switches to `false`, restart the application/worker as needed, and submit one job. The worker accepts only a signed, current request with a unique request ID.
4. Observe the job until `completed`. Verify the local SQLite queue has a `qa_passed` attempt and three exports: vertical 1080x1920, square 1080x1080, and landscape 1920x1080.
5. Return both kill switches to `true`, restart the services, and capture the sanitized job ID plus acceptance result. Do not enable a paid provider after the fixture run.

## Recovery and rotation

Jobs with an expired lease return to the queue. Terminal provider/QA failures remain in SQLite with sanitized categories and are not retried automatically. Keep the worker disabled during investigation; do not edit SQLite records to manufacture a completion.

Back up the named Docker volume after stopping the service:

```bash
docker compose stop
docker run --rm -v video-worker-data:/data -v "$PWD":/backup alpine tar czf /backup/video-worker-backup.tgz -C /data .
docker compose start
```

For suspected secret exposure, set a new `openssl rand -hex 32` secret in both the VPS and server-side application environment, restart both services, and perform a new controlled fixture run. Do not rotate only one side: that creates signed-job failures by design.

## Release boundary

Paid provider adapters require their own release with fixed pricing, private media download/storage, polling, cancellation, cost reconciliation, health monitoring, and operator approval. The worker must remain fixture-only until then.
