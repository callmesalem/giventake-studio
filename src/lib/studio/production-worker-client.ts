import { randomUUID } from "node:crypto";

import {
  createWorkerRequestSignature,
  createWorkerSignature,
  productionRenderJobSchema,
  workerStatusRequestSchema,
  type ProductionRenderJob,
  type WorkerStatusRequest,
} from "./render-job";

type WorkerJobStatus = {
  id: string;
  status: string;
};

type ProductionWorkerClientOptions = {
  baseUrl: string;
  sharedSecret: string;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  requestId?: () => string;
};

function responseStatus(payload: unknown): WorkerJobStatus {
  if (!payload || typeof payload !== "object")
    throw new Error("Video worker returned an invalid response.");
  const record = payload as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.status !== "string")
    throw new Error("Video worker returned an invalid response.");
  return { id: record.id, status: record.status };
}

export function createProductionWorkerClient(options: ProductionWorkerClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const requestId = options.requestId ?? randomUUID;

  function headers(signature: string, timestamp: string, id: string, hasJsonBody = false) {
    const result = new Headers({
      "x-studio-timestamp": timestamp,
      "x-studio-request-id": id,
      "x-studio-signature": signature,
    });
    if (hasJsonBody) result.set("content-type", "application/json");
    return result;
  }

  async function readResponse(response: Response): Promise<WorkerJobStatus> {
    if (!response.ok)
      throw new Error(`Video worker rejected request with status ${response.status}.`);
    return responseStatus(await response.json());
  }

  return {
    async enqueue(jobInput: ProductionRenderJob): Promise<WorkerJobStatus> {
      const job = productionRenderJobSchema.parse(jobInput);
      const timestamp = now().toISOString();
      const id = requestId();
      const signature = createWorkerSignature(job, options.sharedSecret, timestamp, id);
      const response = await fetcher(`${baseUrl}/v1/jobs`, {
        method: "POST",
        headers: headers(signature, timestamp, id, true),
        body: JSON.stringify(job),
      });
      return readResponse(response);
    },
    async getStatus(requestInput: WorkerStatusRequest): Promise<WorkerJobStatus> {
      const request = workerStatusRequestSchema.parse(requestInput);
      const timestamp = now().toISOString();
      const id = requestId();
      const signature = createWorkerRequestSignature(request, options.sharedSecret, timestamp, id);
      const query = new URLSearchParams({ tenantId: request.tenantId });
      const response = await fetcher(
        `${baseUrl}/v1/jobs/${encodeURIComponent(request.jobId)}?${query}`,
        {
          headers: headers(signature, timestamp, id),
        },
      );
      return readResponse(response);
    },
  };
}
