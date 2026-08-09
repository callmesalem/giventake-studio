import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

const csrf = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({ requestMiddleware: [csrf] }));
