/**
 * CRM dashboard auth — TanStack Start server functions (client-safe module).
 *
 * This file is imported by route components, so it must stay free of any
 * server-only import. All cookie/token/service-role logic lives in
 * ./crm-auth.server.ts and is reached only through the handlers below, which run
 * exclusively on the server. Validators are pure and safe to run on both sides.
 */
import { createServerFn } from "@tanstack/react-start";
import type { CrmSession } from "@/server/crm/auth";

export interface CrmLoginInput {
  email: string;
  password: string;
}

export interface AddTeamMemberInput {
  email: string;
  fullName: string;
  role: "admin" | "member";
}

function validateLogin(data: CrmLoginInput): CrmLoginInput {
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Response("A valid email is required", { status: 400 });
  }
  if (password.length < 1) {
    throw new Response("Password is required", { status: 400 });
  }
  return { email, password };
}

function validateAddMember(data: AddTeamMemberInput): AddTeamMemberInput {
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  const fullName = typeof data?.fullName === "string" ? data.fullName.trim() : "";
  const role = data?.role === "admin" ? "admin" : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Response("A valid email is required", { status: 400 });
  }
  if (fullName.length < 2) {
    throw new Response("A full name is required", { status: 400 });
  }
  return { email, fullName, role };
}

export const loginCrm = createServerFn({ method: "POST" })
  .validator(validateLogin)
  .handler(async ({ data }) => (await import("./crm-auth.server")).loginImpl(data));

export const logoutCrm = createServerFn({ method: "POST" }).handler(async () =>
  (await import("./crm-auth.server")).logoutImpl(),
);

export const getCrmSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<CrmSession | null> => (await import("./crm-auth.server")).resolveCrmSession(),
);

export const addTeamMember = createServerFn({ method: "POST" })
  .validator(validateAddMember)
  .handler(async ({ data }) => (await import("./crm-auth.server")).addTeamMemberImpl(data));

export const listTeamMembers = createServerFn({ method: "GET" }).handler(async () =>
  (await import("./crm-auth.server")).listTeamMembersImpl(),
);
