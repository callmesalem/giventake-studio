import { createStudioRepository } from "./repository";
import { createStudioService } from "./service";

const studioServerKey = "__giventakeVideoStudioServer";

type StudioServer = {
  repository: ReturnType<typeof createStudioRepository>;
  service: ReturnType<typeof createStudioService>;
};

function getGlobalStore(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

export function getStudioServer(): StudioServer {
  const store = getGlobalStore();
  const existing = store[studioServerKey] as StudioServer | undefined;
  if (existing) return existing;

  const repository = createStudioRepository();
  const server = { repository, service: createStudioService(repository) };
  store[studioServerKey] = server;
  return server;
}
