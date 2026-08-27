import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Component tests.
 *
 * Deliberately separate from vite.config.ts. That config comes from
 * @lovable.dev/vite-tanstack-config and carries the TanStack Start and Nitro
 * plugins, which try to build a server and generate a route tree — neither of
 * which a component test needs, and both of which fail outside a real build.
 *
 * So this declares only what rendering a component requires: the React plugin,
 * a DOM, and the one path alias the components use.
 *
 * The node --test suite still owns everything pure (guards, gates, money) and
 * runs without a browser. This covers what only exists once React has rendered:
 * empty states, conditional gates, error text a user would actually read.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/components/**/*.test.tsx"],
    // Component tests must never reach the network. If one tries, that is a
    // test asserting against a real server by accident, and it should fail
    // loudly rather than pass slowly.
    testTimeout: 10000,
    restoreMocks: true,
  },
});
