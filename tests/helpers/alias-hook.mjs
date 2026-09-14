/**
 * Resolve "@/..." imports for the node test harness.
 *
 * tsconfig maps "@/*" to "./src/*" and the bundler honours it, but node's ESM
 * resolver treats "@/lib" as a bare PACKAGE specifier and fails with
 * ERR_MODULE_NOT_FOUND. The consequence was not cosmetic: a module that imported
 * by alias could not be loaded by a test at all, however it was written, which
 * is why the server modules with tests all import by relative path and why
 * src/server/approvals/deps.ts had none.
 *
 * Installed via `--import` in the `test` script, so every test file gets it.
 *
 * This is RESOLUTION ONLY. It rewrites a specifier and hands off; it does not
 * transform code. So .tsx modules remain unloadable here, because
 * --experimental-strip-types removes type annotations but does not compile JSX.
 * Route components still need a different tool, and this hook does not pretend
 * otherwise.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** <repo>/src, derived from this file's own location rather than cwd, so the
 *  hook behaves the same whatever directory the runner was started from. */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

    const base = resolve(SRC, specifier.slice(2));

    // Extensionless imports are the norm here: tsconfig uses "Bundler"
    // resolution. Every one of the alias specifiers in src/ resolves to an exact
    // file, a .ts or a .tsx, and none to a directory index, so these three
    // candidates are the whole search rather than a first guess at one.
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }

    // Nothing matched. Fail here rather than handing back: the default resolver
    // reports an unresolvable "@/lib/typo" as `Cannot find package '@/lib'`,
    // naming the prefix instead of the module asked for, which sends a reader
    // hunting for a missing dependency when what they have is a typo. This hook
    // knows the real specifier and every path it tried, so it says both.
    //
    // It still fails closed. Guessing a nearby file would turn a missing module
    // into a wrong one, which is far worse than an error.
    const error = new Error(
      `Cannot resolve "${specifier}" via the @/ alias. Tried: ${base}, ${base}.ts, ${base}.tsx`,
    );
    error.code = "ERR_MODULE_NOT_FOUND";
    throw error;
  },
});
