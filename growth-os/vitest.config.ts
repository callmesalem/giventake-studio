import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [viteReact(), tsConfigPaths()],
  test: {
    environment: "jsdom",
  },
});
