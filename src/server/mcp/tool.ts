// One wrapper for every tool: validate, resolve dependencies late, and never
// let an exception become a protocol error the client cannot read.
import type { z } from "zod";
import { explain, fail, ok } from "./result.ts";
import type { McpDeps, ToolInput, ToolSpec } from "./types.ts";

export interface ToolDefinition<S extends ToolInput> {
  name: string;
  description: string;
  inputSchema: S;
  readOnly: boolean;
  run: (args: z.infer<S>, deps: McpDeps) => Promise<unknown>;
}

export function defineTool<S extends ToolInput>(
  getDeps: () => McpDeps,
  definition: ToolDefinition<S>,
): ToolSpec<S> {
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    readOnly: definition.readOnly,
    async handler(raw: unknown) {
      const parsed = definition.inputSchema.safeParse(raw ?? {});
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        const path = first?.path.length ? first.path.join(".") : "arguments";
        return fail(`Invalid ${path}: ${first?.message ?? "bad input"}.`);
      }
      let deps: McpDeps;
      try {
        deps = getDeps();
      } catch (error) {
        return fail(explain(error));
      }
      try {
        return ok(await definition.run(parsed.data, deps));
      } catch (error) {
        return fail(explain(error));
      }
    },
  };
}
