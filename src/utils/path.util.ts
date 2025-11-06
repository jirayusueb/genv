import { access } from "node:fs/promises";
import { join, resolve } from "node:path";

export function determineFilename(envName: string): string {
  // Special handling for environment names
  if (envName === "local") {
    return ".env.local";
  }
  if (envName === "production") {
    return ".env";
  }

  return `.env.${envName}`;
}

export type PathConfig = {
  appName: string;
  envName: string;
  app: { path?: string };
  envConfig: { path?: string };
  outputDir: string;
  rootDir: string;
};

export function determineFilePath(config: PathConfig): string {
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

export type PathOptions = {
  appName: string;
  envName: string;
  app: { path?: string };
  envConfig: { path?: string };
  autoDetectedDir: string | null;
  rootDir: string;
};

export function determineOutputPath(options: PathOptions): string {
  // Determine filename based on environment name
  const filename = determineFilename(options.envName);

  // Determine path priority:
  // 1. env-level path (highest)
  // 2. app-level path
  // 3. auto-detected directory
  // 4. rootDir fallback (lowest)
  if (options.envConfig.path) {
    const path = options.envConfig.path.startsWith("/")
      ? options.envConfig.path
      : resolve(options.rootDir, options.envConfig.path);
    return join(path, filename);
  }

  if (options.app.path) {
    const path = options.app.path.startsWith("/")
      ? options.app.path
      : resolve(options.rootDir, options.app.path);
    return join(path, filename);
  }

  if (options.autoDetectedDir) {
    return join(options.autoDetectedDir, filename);
  }

  return join(options.rootDir, `${options.appName}.${options.envName}.env`);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// TODO: Performance - Consider parallel path checking
// Currently checks paths sequentially. For monorepos with many apps, parallel checking
// could improve performance. Also consider caching results to avoid repeated filesystem access.
// TODO: Refactor - Extract magic strings to constants
// The directory names "packages", "apps" are hardcoded. Consider extracting them to
// constants like `const MONOREPO_DIRS = ["packages", "apps"] as const` for better
// maintainability and configurability.
export async function findAppDirectory(
  appName: string,
  rootDir: string
): Promise<string | null> {
  const possiblePaths = [
    join(rootDir, "packages", appName),
    join(rootDir, "apps", appName),
    join(rootDir, appName),
  ];

  // Check standard paths first
  for (const path of possiblePaths) {
    if (await pathExists(path)) {
      return path;
    }
  }

  // Check for scoped packages (e.g., @org/app-name)
  if (appName.startsWith("@")) {
    const [scope, name] = appName.split("/");
    if (scope && name) {
      const scopedPaths = [
        join(rootDir, "packages", scope, name),
        join(rootDir, "apps", scope, name),
        join(rootDir, scope, name),
      ];

      for (const path of scopedPaths) {
        if (await pathExists(path)) {
          return path;
        }
      }
    }
  }

  return null;
}
