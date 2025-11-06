import { join } from "node:path";
import { err, ok, type Result } from "neverthrow";
import type { EnvConfig } from "@/types";

// TODO: Performance - Consider compiling regex once at module level
// The regex pattern is currently defined as a constant, which is good.
// However, if we need to reuse it with different flags, consider using RegExp constructor.
const VARIABLE_REF_PATTERN = /\$\{shared:([^}]+)\}/g;

// TODO: Improve error handling - Support multiple missing variables
// Currently only reports the first missing variable. Consider collecting all missing
// variables and reporting them together for better user experience.
function resolveVariable(
  value: string,
  sharedVars: Record<string, string | number | boolean>
): Result<string, Error> {
  let resolved = value;
  let hasError: Error | null = null;

  resolved = value.replace(VARIABLE_REF_PATTERN, (_match, varName) => {
    const resolvedVar = sharedVars[varName];
    if (resolvedVar === undefined) {
      hasError = new Error(`Shared variable '${varName}' not found`);
      return value; // Return original value if error occurs
    }
    // Convert shared variable to string for interpolation
    return String(resolvedVar);
  });

  if (hasError) {
    return err(hasError);
  }

  return ok(resolved);
}

type VariableValue =
  | string
  | number
  | boolean
  | { value: string | number | boolean; comment?: string; type?: string };

function extractVariableValue(varValue: VariableValue): {
  value: string | number | boolean;
  comment?: string;
} {
  if (
    typeof varValue === "string" ||
    typeof varValue === "number" ||
    typeof varValue === "boolean"
  ) {
    return { value: varValue };
  }
  return {
    value: varValue.value,
    comment: varValue.comment,
  };
}

function convertValueToString(value: string | number | boolean): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  // TODO: Edge case - Fallback for unexpected types (line 64)
  // This should never be reached due to TypeScript types, but serves as a defensive fallback.
  // Consider if this can be removed or if additional type narrowing is needed.
  return String(value);
}

// TODO: Refactor - Extract value formatting logic to separate function
// The value formatting logic (lines 105-114) is complex and could be extracted to a function
// like `formatVariableValue(resolvedValue: string, originalValue: string | number | boolean, rawValue: string | number | boolean): string`
// to improve readability and testability.
function generateEnvContent(
  variables: Record<string, VariableValue>,
  sharedVars: Record<string, string | number | boolean>
): Result<string, Error> {
  const lines: string[] = [];

  for (const [key, varValue] of Object.entries(variables)) {
    const { value: rawValue, comment: inlineComment } =
      extractVariableValue(varValue);

    // Convert to string for variable resolution (shared vars are always strings)
    const stringValue = convertValueToString(rawValue);
    const resolvedResult = resolveVariable(stringValue, sharedVars);
    if (resolvedResult.isErr()) {
      return err(
        new Error(
          `Failed to resolve variable for ${key}: ${resolvedResult.error.message}`
        )
      );
    }

    // Add comment if available (from inline comment in variable object)
    if (inlineComment) {
      lines.push(`# ${inlineComment}`);
    }

    // Format the value: numbers and booleans don't need quotes
    // If the resolved value contains shared variable references, it's already a string
    // Otherwise, use the original type to determine formatting
    let formattedValue: string;
    if (resolvedResult.value !== stringValue) {
      // Shared variable was resolved, use the resolved string as-is
      formattedValue = resolvedResult.value;
    } else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      // No shared variable resolution, format based on original type
      formattedValue = String(rawValue);
    } else {
      formattedValue = resolvedResult.value;
    }

    lines.push(`${key}=${formattedValue}`);
  }

  return ok(`${lines.join("\n")}\n`);
}

function getEnvironmentVariables(
  env:
    | Record<string, string | number | boolean>
    | {
        variables: Record<string, VariableValue>;
        path?: string;
      }
): Record<string, VariableValue> {
  // Check if it's the new format with variables key
  if ("variables" in env && typeof env.variables === "object") {
    return env.variables;
  }
  // Legacy format: flat object (can be string, number, or boolean)
  return env as Record<string, VariableValue>;
}

function getEnvironmentConfig(
  env:
    | Record<string, string | number | boolean>
    | {
        variables: Record<string, VariableValue>;
        path?: string;
      }
): { path?: string } {
  // Check if it's the new format with path
  if ("path" in env && typeof env === "object" && "path" in env) {
    const pathValue = env.path;
    // TODO: Edge case - Non-string path values (line 141)
    // The path should always be a string according to the type, but we defensively check.
    // Consider if this type narrowing is necessary or if the type system can be improved.
    return {
      path: typeof pathValue === "string" ? pathValue : undefined,
    };
  }
  return {};
}

// TODO: Refactor - Extract to shared utility module
// This function is duplicated in cli.ts. Consider creating a shared utils module
// to avoid code duplication and ensure consistency.
function determineFilename(envName: string): string {
  // Special handling for environment names
  if (envName === "local") {
    return ".env.local";
  }
  if (envName === "production") {
    return ".env";
  }
  return `.env.${envName}`;
}

type PathConfig = {
  appName: string;
  envName: string;
  app: { path?: string };
  envConfig: { path?: string };
  outputDir: string;
  rootDir: string;
};

// TODO: Refactor - Unify path resolution logic with cli.ts
// This function has similar logic to `determineOutputPath` in cli.ts. Consider creating
// a shared utility module with a unified path resolution function that handles both cases.
// This would reduce duplication and ensure consistent behavior across the codebase.
function determineFilePath(config: PathConfig): string {
  // Determine filename based on environment name
  const filename = determineFilename(config.envName);

  // Determine path: env-level > app-level > default
  if (config.envConfig.path) {
    return config.envConfig.path.startsWith("/")
      ? join(config.envConfig.path, filename)
      : join(config.rootDir, config.envConfig.path, filename);
  }

  if (config.app.path) {
    return config.app.path.startsWith("/")
      ? join(config.app.path, filename)
      : join(config.rootDir, config.app.path, filename);
  }

  return join(config.outputDir, `${config.appName}.${config.envName}.env`);
}

export function generateEnvFile(
  config: EnvConfig,
  appName: string,
  environment: string,
  _outputPath: string
): Result<string, Error> {
  const sharedVars = config.shared?.variables ?? {};
  const app = config.apps[appName];

  if (!app) {
    return err(
      new Error(
        `App '${appName}' not found in config. Available apps: ${Object.keys(
          config.apps
        ).join(", ")}`
      )
    );
  }

  const env = app.environments[environment];

  if (!env) {
    return err(
      new Error(
        `Environment '${environment}' not found for app '${appName}'. Available environments: ${Object.keys(
          app.environments
        ).join(", ")}`
      )
    );
  }

  const variables = getEnvironmentVariables(env);
  return generateEnvContent(variables, sharedVars);
}

export function generateAllEnvFiles(
  config: EnvConfig,
  outputDir: string,
  rootDir: string = process.cwd()
): Result<Array<{ path: string; content: string }>, Error> {
  const files: Array<{ path: string; content: string }> = [];
  const sharedVars = config.shared?.variables ?? {};

  for (const [appName, app] of Object.entries(config.apps)) {
    for (const [envName, env] of Object.entries(app.environments)) {
      const variables = getEnvironmentVariables(env);
      const envConfig = getEnvironmentConfig(env);

      const contentResult = generateEnvContent(variables, sharedVars);
      if (contentResult.isErr()) {
        return err(
          new Error(
            `Failed to generate env for ${appName}.${envName}: ${contentResult.error.message}`
          )
        );
      }

      const filePath = determineFilePath({
        appName,
        envName,
        app,
        envConfig,
        outputDir,
        rootDir,
      });

      files.push({ path: filePath, content: contentResult.value });
    }
  }

  return ok(files);
}
