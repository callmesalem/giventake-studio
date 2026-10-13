// One wrapper for every tool: validate, resolve dependencies late, and never
// let an exception become a protocol error the client cannot read.
import type { z } from "zod";
import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { explain, fail, ok } from "./result.ts";
import type { McpDeps, ToolInput, ToolSpec } from "./types.ts";

/**
 * The handler's own `safeParse` is the single validator for tool arguments:
 * it produces our `{error, notice}` envelope with an "Invalid <path>: …"
 * message. `McpServer`'s `tools/call` runs its own `~standard.validate` on
 * `inputSchema` BEFORE our handler ever sees the arguments, and on failure
 * throws a bare "Input validation error: …" that never reaches our envelope.
 * So every tool is registered with a schema whose `~standard.validate` always
 * succeeds and hands the raw arguments straight through — `~standard.jsonSchema`
 * still delegates to the real zod object, so `tools/list` advertises the exact
 * same JSON Schema it would without this wrapper.
 */
export function passthroughInputSchema(schema: ToolInput): StandardSchemaWithJSON {
  const std = schema["~standard"] as unknown as StandardSchemaWithJSON["~standard"];
  return {
    "~standard": {
      ...std,
      validate: (value: unknown) => ({ value }),
    },
  };
}

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
