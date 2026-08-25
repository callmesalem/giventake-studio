import { createFileRoute, redirect } from "@tanstack/react-router";

import { completeStudioAuthCallbackAction } from "@/lib/studio/auth-actions";

type CallbackSearch = { code?: string };

export const Route = createFileRoute("/studio/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  loaderDeps: ({ search }) => ({ code: search.code }),
  loader: async ({ deps }) => {
    if (!deps.code) throw redirect({ to: "/studio/sign-in" });
    try {
      await completeStudioAuthCallbackAction({ data: { code: deps.code } });
    } catch {
      throw redirect({ to: "/studio/sign-in" });
    }
    throw redirect({ to: "/studio" });
  },
});
