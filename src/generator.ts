import { err, ok, type Result } from "neverthrow";
import { VARIABLE_REF_PATTERN } from "@/constants/regex.constant";
import type { EnvConfig } from "@/models/env-config.model";
import type {
  AppEnvironmentValue,
  EnvField,
  RawValue,
  VariablesRecord,
  VariableValue,
} from "@/types";
import { determineFilePath } from "@/utils/path.util";
import {
  isBoolean,
  isEnvFieldExtend,
  isNumber,
  isString,
} from "@/utils/type.util";

function resolveVariable(
  value: string,
  sharedVars: EnvField
): Result<string, Error> {
  let resolved = value;
  const missingVars: string[] = [];

  resolved = value.replace(VARIABLE_REF_PATTERN, (_match, varName) => {
    const resolvedVar = sharedVars[varName];
    if (resolvedVar === undefined) {
      // Collect missing variable names (avoid duplicates)
      if (!missingVars.includes(varName)) {
        missingVars.push(varName);
      }
      return _match; // Return original match if variable is missing
    }
    // Convert shared variable to string for interpolation
    return String(resolvedVar);
  });

  if (missingVars.length > 0) {
    const errorMessage =
      missingVars.length === 1
        ? `Shared variable '${missingVars[0]}' not found`
        : `Shared variables not found: ${missingVars.map((v) => `'${v}'`).join(", ")}`;
    return err(new Error(errorMessage));
  }

  return ok(resolved);
}

function extractVariableValue(varValue: VariableValue): {
  value: RawValue;
  comment?: string;
} {
  if (isString(varValue) || isNumber(varValue) || isBoolean(varValue)) {
    return { value: varValue };
  }
  return {
    value: varValue.value,
    comment: varValue.comment,
  };
}

function formatVariableValue(
  resolvedValue: string,
  originalStringValue: string,
  rawValue: RawValue
): string {
  // If the resolved value contains shared variable references, it's already a string
  if (resolvedValue !== originalStringValue) {
    return resolvedValue;
  }
  // No shared variable resolution, format based on original type
  if (isNumber(rawValue) || isBoolean(rawValue)) {
    return String(rawValue);
  }
  return resolvedValue;
}

function collectMissingVariables(
  errors: Array<{ variable: string; message: string }>
): Set<string> {
  const allMissingVars = new Set<string>();
  for (const error of errors) {
    // Extract variable names from error messages
    const varMatch = error.message.match(/'([^']+)'/g);
    if (varMatch) {
      for (const match of varMatch) {
        const varName = match.replace(/'/g, "");
        allMissingVars.add(varName);
      }
    }
  }
  return allMissingVars;
}

function createErrorForMissingVariables(
  errors: Array<{ variable: string; message: string }>
): Error {
  if (errors.length === 1) {
    const firstError = errors[0];
    if (!firstError) {
      return new Error("Unknown error occurred");
    }
    return new Error(
      `Failed to resolve variable for ${firstError.variable}: ${firstError.message}`
    );
  }

  const allMissingVars = collectMissingVariables(errors);
  const missingVarsList = Array.from(allMissingVars)
    .map((v) => `'${v}'`)
    .join(", ");
  const variableNames = errors.map((e) => e.variable).join(", ");
  const errorMessage =
    allMissingVars.size === 1
      ? `Shared variable ${missingVarsList} not found in variables: ${variableNames}`
      : `Shared variables not found (${missingVarsList}) in variables: ${variableNames}`;

  return new Error(errorMessage);
}

function generateEnvContent(
  variables: VariablesRecord,
  sharedVars: EnvField
): Result<string, Error> {
  const lines: string[] = [];
  const errors: Array<{ variable: string; message: string }> = [];

  for (const [key, varValue] of Object.entries(variables)) {
    const { value: rawValue, comment: inlineComment } =
      extractVariableValue(varValue);

    const stringValue = String(rawValue);
    const resolvedResult = resolveVariable(stringValue, sharedVars);
    if (resolvedResult.isErr()) {
      // Collect error but continue processing other variables
      errors.push({
        variable: key,
        message: resolvedResult.error.message,
      });
      continue;
    }

    // Add comment if available (from inline comment in variable object)
    if (inlineComment) {
      lines.push(`# ${inlineComment}`);
    }

    const formattedValue = formatVariableValue(
      resolvedResult.value,
      stringValue,
      rawValue
    );
    lines.push(`${key}=${formattedValue}`);
  }

  // Report all errors together if any were found
  if (errors.length > 0) {
    return err(createErrorForMissingVariables(errors));
  }

  return ok(`${lines.join("\n")}\n`);
}

function getEnvironmentVariables(env: AppEnvironmentValue): VariablesRecord {
  // Check if it's the new format with variables key
  if ("variables" in env && typeof env.variables === "object") {
    return env.variables;
  }
  // Legacy format: flat object (can be string, number, or boolean)
  return env as VariablesRecord;
}

function getEnvironmentConfig(env: AppEnvironmentValue): { path?: string } {
  if (isEnvFieldExtend(env)) {
    return {
      path: env.path,
    };
  }
  return {};
}

export function generateEnvFile(
  config: EnvConfig,
  appName: string,
  environment: string,
  _outputPath: string
): Result<string, Error> {
  const sharedVars = config.getSharedVariables();
  const app = config.getApp(appName);

  if (!app) {
    return err(
      new Error(
        `App '${appName}' not found in config. Available apps: ${config.getAppNames().join(", ")}`
      )
    );
  }

  const env = config.getEnvironment(appName, environment);

  if (!env) {
    return err(
      new Error(
        `Environment '${environment}' not found for app '${appName}'. Available environments: ${config.getEnvironmentNames(appName).join(", ")}`
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
  const sharedVars = config.getSharedVariables();

  for (const appName of config.getAppNames()) {
    const app = config.getApp(appName);
    if (!app) {
      continue;
    }

    for (const envName of config.getEnvironmentNames(appName)) {
      const env = config.getEnvironment(appName, envName);
      if (!env) {
        continue;
      }

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
