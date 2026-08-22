import { createStudioRepository } from "./repository";
import { createStudioService } from "./service";
import { createSupabaseStudioRepository } from "./supabase-repository";
import { createStudioUserSupabase } from "./supabase.server";
import type { StudioRepository } from "./types";

const studioServerKey = "__giventakeVideoStudioServer";

type StudioServer = {
  kind: "memory" | "supabase";
  repository: StudioRepository;
  service: ReturnType<typeof createStudioService>;
};

export class StudioConfigurationError extends Error {
  constructor(public readonly code: "STUDIO_PERSISTENCE_UNAVAILABLE") {
    super(code);
    this.name = "StudioConfigurationError";
  }
}

function getGlobalStore(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function configured(environment: Record<string, string | undefined>): boolean {
  return Boolean(
    environment.SUPABASE_URL?.trim() &&
    environment.SUPABASE_ANON_KEY?.trim() &&
    environment.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function getMemoryStudioServer(): StudioServer {
  const store = getGlobalStore();
  const existing = store[studioServerKey] as StudioServer | undefined;
  if (existing) return existing;

  const repository = createStudioRepository();
  const server: StudioServer = {
    kind: "memory",
    repository,
    service: createStudioService(repository),
  };
  store[studioServerKey] = server;
  return server;
}

export async function getStudioServerFor(
  environment: Record<string, string | undefined>,
): Promise<StudioServer> {
  if (configured(environment) || environment.NODE_ENV === "production") {
    throw new StudioConfigurationError("STUDIO_PERSISTENCE_UNAVAILABLE");
  }
  return getMemoryStudioServer();
}

export async function getStudioServer(): Promise<StudioServer> {
  if (!configured(process.env)) return getStudioServerFor(process.env);
  const repository = createSupabaseStudioRepository(createStudioUserSupabase());
  return { kind: "supabase", repository, service: createStudioService(repository) };
}
