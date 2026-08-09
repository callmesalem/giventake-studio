import { createServerFn } from "@tanstack/react-start";
import { supportSessionInputSchema } from "./support.schemas";

export const getSupportAdminData = createServerFn({ method: "GET" }).handler(async () => {
  const { getSupportAdminData: loadData } = await import("./support.server");
  return loadData();
});

export const getSupportSessionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getSupportSessionStatus: loadStatus } = await import("./support.server");
  return loadStatus();
});

export const startSupportSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => supportSessionInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { startSupportSession: start } = await import("./support.server");
    return start(data);
  });

export const endSupportSession = createServerFn({ method: "POST" }).handler(async () => {
  const { endSupportSession: end } = await import("./support.server");
  return end();
});
