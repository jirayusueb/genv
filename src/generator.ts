import { join } from "node:path";
import { err, ok, type Result } from "neverthrow";
import type { EnvConfig } from "@/types";

const VARIABLE_REF_PATTERN = /\$\{shared:([^}]+)\}/g;

function resolveVariable(
  value: string,
  sharedVars: Record<string, string>
): Result<string, Error> {
  let resolved = value;
  let hasError: Error | null = null;

  resolved = value.replace(VARIABLE_REF_PATTERN, (_match, varName) => {
    const resolvedVar = sharedVars[varName];
    if (resolvedVar === undefined) {
      hasError = new Error(`Shared variable '${varName}' not found`);
      return value; // Return original value if error occurs
    }
    return resolvedVar;
  });

  if (hasError) {
    return err(hasError);
  }

  return ok(resolved);
}

type VariableValue =
  | string
  | { value: string; comment?: string; type?: string };

function extractVariableValue(varValue: VariableValue): {
  value: string;
  comment?: string;
} {
  if (typeof varValue === "string") {
    return { value: varValue };
  }
  return {
    value: varValue.value,
    comment: varValue.comment,
  };
}

function generateEnvContent(
  variables: Record<string, VariableValue>,
  sharedVars: Record<string, string>
): Result<string, Error> {
  const lines: string[] = [];

  for (const [key, varValue] of Object.entries(variables)) {
    const { value: rawValue, comment: inlineComment } =
      extractVariableValue(varValue);

    const resolvedResult = resolveVariable(rawValue, sharedVars);
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

    lines.push(`${key}=${resolvedResult.value}`);
  }

  return ok(`${lines.join("\n")}\n`);
}

function getEnvironmentVariables(
  env:
    | Record<string, string>
    | {
        variables: Record<string, VariableValue>;
        path?: string;
      }
): Record<string, VariableValue> {
  // Check if it's the new format with variables key
  if ("variables" in env && typeof env.variables === "object") {
    return env.variables;
  }
  // Legacy format: flat object
  return env as Record<string, string>;
}

function getEnvironmentConfig(
  env:
    | Record<string, string>
    | {
        variables: Record<string, VariableValue>;
        path?: string;
      }
): { path?: string } {
  // Check if it's the new format with path
  if ("path" in env && typeof env === "object") {
    return {
      path: env.path,
    };
  }
  return {};
}

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
