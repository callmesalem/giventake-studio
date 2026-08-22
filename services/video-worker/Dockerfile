FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 studio \
  && mkdir -p /var/lib/giventake-video-worker \
  && chown -R studio:studio /var/lib/giventake-video-worker

WORKDIR /app
COPY --chown=studio:studio package.json ./package.json
COPY --chown=studio:studio src ./src

USER studio
ENV STUDIO_WORKER_HOST=0.0.0.0
EXPOSE 8788
CMD ["node", "src/index.mjs"]
