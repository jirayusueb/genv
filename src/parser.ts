import { err, ok, Result } from "neverthrow";
import { parse as parseYaml } from "yaml";
import { ZodError } from "zod";
import { EnvConfig } from "@/models/env-config.model";
import type { EnvConfig as EnvConfigType } from "@/types";
import { EnvConfigSchema } from "@/types";

// TODO: Improve error formatting - Consider adding error codes or structured error info
// The current error formatting is human-readable but could be enhanced with error codes
// or structured information for programmatic error handling.
function formatZodError(error: ZodError): string {
  // TODO: Edge case - ZodError with empty issues array (lines 8-9)
  // This branch is difficult to trigger in practice as ZodError typically always has issues.
  // Consider if this defensive check is necessary or if it can be removed.
  if (!error.issues || error.issues.length === 0) {
    return "Validation error: Invalid configuration";
  }

  const messages = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : "";
    const message = issue.message;
    return `${message}${path}`;
  });

  if (messages.length === 1) {
    return `Validation error: ${messages[0]}`;
  }

  return `Validation errors:\n${messages.map((m) => `  - ${m}`).join("\n")}`;
}

function parseYamlSafe(content: string): Result<unknown, Error> {
  return Result.fromThrowable(
    () => parseYaml(content),
    (error) => {
      if (error instanceof Error) {
        if (error.message.includes("YAML")) {
          return new Error(`YAML parsing error: ${error.message}`);
        }
        return error;
      }

      return new Error(String(error));
    }
  )();
}

export function parseConfig(yamlContent: string): Result<EnvConfig, Error> {
  return parseYamlSafe(yamlContent)
    .andThen((parsed) => {
      if (!parsed) {
        return err(new Error("YAML file is empty or invalid"));
      }

      const validated = EnvConfigSchema.safeParse(parsed);

      if (!validated.success) {
        return err(new Error(formatZodError(validated.error)));
      }

      return ok(EnvConfig.from(validated.data as EnvConfigType));
    })
    .mapErr((error) => {
      // TODO: Edge case - ZodError handling in mapErr (lines 56-57)
      // This branch is difficult to trigger as parseYamlSafe wraps errors as Error instances.
      // A ZodError would only reach here if thrown directly from yaml.parse, which is unlikely.
      // Consider if this defensive check is necessary or if it can be simplified.
      if (error instanceof ZodError) {
        return new Error(formatZodError(error));
      }
      return error;
    });
}
