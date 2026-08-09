import { createFileRoute, redirect } from "@tanstack/react-router";
import { completeAuthCallback } from "@/features/auth/auth.functions";

type CallbackSearch = {
  code?: string;
};

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  loaderDeps: ({ search }) => ({ code: search.code }),
  loader: async ({ deps }) => {
    if (!deps.code) throw redirect({ to: "/login" });

    try {
      await completeAuthCallback({ data: { code: deps.code } });
    } catch {
      throw redirect({ to: "/login" });
    }
    throw redirect({ to: "/select-tenant" });
  },
});
