// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Cloudflare Email Routing (reply detection) and the cron send tick can ONLY
  // be reached through nitro's `cloudflare:email` / `cloudflare:scheduled`
  // hooks. The nitro preset generates the Worker's exported object itself, so
  // an `email()` or `scheduled()` added to src/server.ts's default export is
  // stripped at build time and never runs.
  //
  // The `nitro` option's declared type is deliberately narrow (preset / output /
  // cloudflare), but @lovable.dev/vite-tanstack-config spreads every key through
  // to nitro() unchanged, so `plugins` is honoured at runtime. Hence the cast.
  //
  // Setting `nitro` at all makes the config treat nitro as an explicit opt-in:
  // a build now fails fast if the `nitro` devDependency is missing instead of
  // silently skipping the deploy build. That is the safer failure.
  nitro: {
    plugins: ["./src/nitro/campaign-email.ts", "./src/nitro/campaign-cron.ts"],
  } as unknown as { preset?: string },

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
