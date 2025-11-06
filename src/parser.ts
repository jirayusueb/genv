import { err, ok, type Result } from "neverthrow";
import { parse as parseYaml } from "yaml";
import { ZodError } from "zod";
import { type EnvConfig, EnvConfigSchema } from "@/types";

function formatZodError(error: ZodError): string {
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
  try {
    const parsed = parseYaml(content);
    return ok(parsed);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("YAML")) {
        return err(new Error(`YAML parsing error: ${error.message}`));
      }
      return err(error);
    }
    return err(new Error(String(error)));
  }
}

export function parseConfig(yamlContent: string): Result<EnvConfig, Error> {
  return parseYamlSafe(yamlContent)
    .andThen((parsed) => {
      if (parsed === null || parsed === undefined) {
        return err(new Error("YAML file is empty or invalid"));
      }

      const validated = EnvConfigSchema.safeParse(parsed);

      if (!validated.success) {
        return err(new Error(formatZodError(validated.error)));
      }

      return ok(validated.data);
    })
    .mapErr((error) => {
      if (error instanceof ZodError) {
        return new Error(formatZodError(error));
      }
      return error;
    });
}
