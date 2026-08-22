import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function verifySignature(payload, headers, secret, now) {
  const timestamp = headers["x-studio-timestamp"];
  const requestId = headers["x-studio-request-id"];
  const signature = headers["x-studio-signature"];
  if (
    typeof timestamp !== "string" ||
    typeof requestId !== "string" ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")
  )
    return false;
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now.getTime() - timestampMs) > 5 * 60 * 1000)
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${stableJson(payload)}`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

function isJob(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.tenantId === "string" &&
    typeof value.campaignId === "string" &&
    typeof value.revisionId === "string" &&
    typeof value.provider === "string" &&
    typeof value.model === "string" &&
    Number.isInteger(value.budgetCents) &&
    value.budgetCents > 0 &&
    Array.isArray(value.storyboard)
  );
}

async function readJson(request, maxBodyBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function respond(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export function createWorkerHttpServer({ repository, config, now = () => new Date() }) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://worker.local");
    if (request.method === "GET" && url.pathname === "/healthz") {
      respond(response, 200, { status: "ok", queue: repository.queueCounts() });
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/jobs") {
      try {
        const payload = await readJson(request, config.maxBodyBytes);
        if (!isJob(payload)) return respond(response, 400, { error: "invalid_job" });
        if (!verifySignature(payload, request.headers, config.sharedSecret, now()))
          return respond(response, 401, { error: "invalid_signature" });
        const requestId = request.headers["x-studio-request-id"];
        if (repository.hasRequest(requestId))
          return respond(response, 409, { error: "replayed_request" });
        if (config.outboundKillSwitch)
          return respond(response, 503, { error: "outbound_disabled" });
        const job = repository.enqueue(payload, requestId, now());
        return respond(response, 202, { id: job.id, status: job.status });
      } catch {
        return respond(response, 400, { error: "invalid_request" });
      }
    }

    const jobId = /^\/v1\/jobs\/([^/]+)$/.exec(url.pathname)?.[1];
    if (request.method === "GET" && jobId) {
      const tenantId = url.searchParams.get("tenantId");
      const payload = { jobId: decodeURIComponent(jobId), tenantId };
      if (!tenantId || !verifySignature(payload, request.headers, config.sharedSecret, now()))
        return respond(response, 401, { error: "invalid_signature" });
      const job = repository.get(payload.jobId);
      if (!job || job.tenantId !== tenantId) return respond(response, 404, { error: "not_found" });
      return respond(response, 200, { id: job.id, status: job.status });
    }

    respond(response, 404, { error: "not_found" });
  });

  return {
    async listen(port = 0, host = "127.0.0.1") {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Worker server did not bind to a TCP address.");
      return { host, port: address.port, url: `http://${host}:${address.port}` };
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
