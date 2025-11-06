import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import yargs from "yargs";
import { generateAllEnvFiles, generateEnvFile } from "@/generator";
import { parseConfig } from "@/parser";
import type { EnvConfig } from "@/types";

// TODO: Improve type safety - Consider extracting EnvConfigType to types.ts
// This type duplicates logic from types.ts and could be unified for better maintainability.
type EnvConfigType =
  | Record<string, string | number | boolean>
  | {
      variables: Record<
        string,
        | string
        | number
        | boolean
        | { value: string | number | boolean; comment?: string; type?: string }
      >;
      path?: string;
    };

function getEnvironmentConfig(env: EnvConfigType): { path?: string } {
  if ("path" in env && typeof env === "object") {
    const pathValue = env.path;
    // TODO: Edge case - Non-string path values (line 25)
    // The path should always be a string according to the type, but we defensively check
    // because EnvConfigType allows number | boolean in the record values.
    // Consider if this type narrowing is necessary or if the type system can be improved.
    return {
      path: typeof pathValue === "string" ? pathValue : undefined,
    };
  }
  return {};
}

// TODO: Refactor - Extract to shared utility module
// This function duplicates determineFilename from generator.ts.
// Consider creating a shared utils module to avoid code duplication.
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

type AppConfig = { path?: string };

type PathOptions = {
  appName: string;
  envName: string;
  app: AppConfig;
  envConfig: { path?: string };
  autoDetectedDir: string | null;
  rootDir: string;
};

// TODO: Refactor - Extract path resolution logic to shared utility
// This function has repetitive path resolution logic (startsWith("/") check and resolve).
// Consider creating a helper function like `resolvePath(path: string, rootDir: string): string`
// to reduce duplication and improve maintainability.
function determineOutputPath(options: PathOptions): string {
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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function handleInit(configPath: string): Promise<number> {
  // Check if config file already exists
  if (await pathExists(configPath)) {
    console.error(
      `Error: Config file '${configPath}' already exists. Remove it first if you want to reinitialize.`
    );
    return 1;
  }

  const defaultConfig = `# genv Configuration File
# This file defines environment variables for your monorepo applications

# Shared variables that can be referenced across all apps using \${shared:VARIABLE_NAME}
shared:
  variables:
    # Example shared variables
    DATABASE_HOST: localhost
    DATABASE_PORT: "5432"
    API_URL: https://api.example.com
    REDIS_HOST: localhost
    REDIS_PORT: "6379"

# Apps in the monorepo
apps:
  # Example app configuration
  frontend:
    # Optional: default output path for all environments (e.g., '/apps/frontend' or 'apps/frontend')
    # path: apps/frontend

    environments:
      local:
        # Variables for local environment
        # Generates: .env.local
        NODE_ENV: development
        VITE_API_URL: http://localhost:3000
        VITE_APP_NAME: My App Local
        VITE_DEBUG: "true"

      development:
        # Variables for development environment
        # Generates: .env.development
        NODE_ENV: development
        VITE_API_URL: \${shared:API_URL}
        VITE_APP_NAME: My App Dev
        VITE_DEBUG: "true"

      production:
        # Variables for production environment
        # Generates: .env
        NODE_ENV: production
        VITE_API_URL: \${shared:API_URL}
        VITE_APP_NAME: My App
        VITE_DEBUG: "false"

  # Another example app
  backend:
    # Optional app-level configuration
    # path: apps/backend

    environments:
      local:
        # Generates: .env.local
        NODE_ENV: development
        DATABASE_URL: postgres://user:pass@localhost:5432/mydb_local
        REDIS_URL: redis://localhost:6379
        API_PORT: "3000"
        LOG_LEVEL: debug

      development:
        # Generates: .env.development
        NODE_ENV: development
        DATABASE_URL: postgres://user:pass@\${shared:DATABASE_HOST}:\${shared:DATABASE_PORT}/mydb_dev
        REDIS_URL: redis://\${shared:REDIS_HOST}:\${shared:REDIS_PORT}
        API_PORT: "3000"
        LOG_LEVEL: debug

      production:
        # Generates: .env
        NODE_ENV: production
        DATABASE_URL: postgres://user:pass@\${shared:DATABASE_HOST}:\${shared:DATABASE_PORT}/mydb_prod
        REDIS_URL: redis://\${shared:REDIS_HOST}:\${shared:REDIS_PORT}
        API_PORT: "3000"
        LOG_LEVEL: warn
`;

  try {
    await writeFile(configPath, defaultConfig, "utf-8");
    console.log(`✓ Created config file: ${configPath}`);
    console.log(
      "\nYou can now edit this file to configure your environment variables."
    );
    console.log(
      `Run 'genv --apply' to generate .env files based on this configuration.`
    );
    return 0;
  } catch (error) {
    console.error(
      `Failed to create config file '${configPath}':`,
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

// TODO: Performance - Consider parallel path checking
// Currently checks paths sequentially. For monorepos with many apps, parallel checking
// could improve performance. Also consider caching results to avoid repeated filesystem access.
// TODO: Refactor - Extract magic strings to constants
// The directory names "packages", "apps" are hardcoded. Consider extracting them to
// constants like `const MONOREPO_DIRS = ["packages", "apps"] as const` for better
// maintainability and configurability.
async function findAppDirectory(
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

// TODO: Refactor - Extract file writing logic to shared utility
// The file writing pattern (mkdir + writeFile + console.log) is duplicated in handleApply,
// handleAll, and handleSingle. Consider creating a helper function like
// `writeEnvFile(path: string, content: string): Promise<void>` to reduce duplication.
async function handleApply(
  config: EnvConfig,
  rootDir: string
): Promise<number> {
  let generatedCount = 0;

  for (const [appName, app] of Object.entries(config.apps)) {
    // Try to find app directory in monorepo structure
    const appDir = await findAppDirectory(appName, rootDir);

    for (const [envName, env] of Object.entries(app.environments)) {
      const envConfig = getEnvironmentConfig(env as EnvConfigType);
      const outputPath = determineOutputPath({
        appName,
        envName,
        app,
        envConfig,
        autoDetectedDir: appDir,
        rootDir,
      });

      const generateResult = generateEnvFile(
        config,
        appName,
        envName,
        outputPath
      );

      if (generateResult.isErr()) {
        console.error(
          `Failed to generate env for ${appName}.${envName}:`,
          generateResult.error.message
        );
        continue;
      }

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, generateResult.value, "utf-8");
      console.log(`✓ Generated: ${outputPath}`);
      generatedCount += 1;
    }
  }

  console.log(`\n✓ Applied ${generatedCount} env file(s) to monorepo`);
  return 0;
}

async function handleAll(config: EnvConfig): Promise<number> {
  const rootDir = process.cwd();
  const generateResult = generateAllEnvFiles(config, ".", rootDir);

  if (generateResult.isErr()) {
    console.error(
      "Failed to generate env files:",
      generateResult.error.message
    );
    return 1;
  }

  // Write all files
  for (const file of generateResult.value) {
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content, "utf-8");
    console.log(`Generated: ${file.path}`);
  }

  console.log(`\n✓ Generated ${generateResult.value.length} env file(s)`);
  return 0;
}

// TODO: Refactor - Break down runCLI into smaller functions
// This function is quite long and handles multiple concerns (argument parsing, config loading,
// routing to different handlers). Consider extracting:
// - `setupYargs(args: string[])` for yargs configuration
// - `loadConfig(configPath: string)` for config loading and parsing
// - `routeCommand(argv, config)` for routing to appropriate handlers
export async function runCLI(args: string[]): Promise<number> {
  // args is already processed (process.argv.slice(2)), so don't use hideBin
  const yargsInstance = yargs(args)
    .scriptName("genv")
    .usage("$0 [options]")
    .option("config", {
      alias: "c",
      type: "string",
      default: "genv.config.yaml",
      description: "Path to genv.config.yaml",
    })
    .option("app", {
      alias: "a",
      type: "string",
      description: "Generate env for specific app",
    })
    .option("env", {
      alias: "e",
      type: "string",
      description: "Generate env for specific environment",
    })
    .option("all", {
      alias: "A",
      type: "boolean",
      default: false,
      description: "Generate all env files for all apps and environments",
    })
    .option("apply", {
      type: "boolean",
      description:
        "Apply env files to monorepo structure (auto-detects app directories)",
    })
    .option("init", {
      alias: "i",
      type: "boolean",
      description: "Initialize a new genv.config.yaml file",
    })
    .help()
    .alias("help", "h")
    .example("npx genv --init", "Initialize a new genv.config.yaml file")
    .example("npx genv --apply", "Apply env files to monorepo")
    .example("genv --all", "Generate all env files")
    .example(
      "genv --app frontend --env development",
      "Generate env for specific app/environment"
    );

  const argv = await yargsInstance.parse();

  // Handle --init: create new config file
  if (argv.init) {
    return await handleInit(argv.config ?? "genv.config.yaml");
  }

  // If no action specified, show help
  const hasAction =
    Boolean(argv.apply) || Boolean(argv.all) || (argv.app && argv.env);
  if (!hasAction) {
    yargsInstance.showHelp();
    return 1;
  }

  const configPath = argv.config ?? "genv.config.yaml";

  // Read config file
  const configContent = await readFile(configPath, "utf-8").catch((error) => {
    console.error(`Error reading config file '${configPath}':`, error.message);
    process.exit(1);
  });

  // Parse config
  const parseResult = parseConfig(configContent);
  if (parseResult.isErr()) {
    console.error("Failed to parse config:", parseResult.error.message);
    return 1;
  }

  const config = parseResult.value;
  const rootDir = process.cwd();

  // Handle --apply: smart monorepo placement
  if (argv.apply) {
    return await handleApply(config, rootDir);
  }

  // Generate env files
  if (argv.all) {
    return await handleAll(config);
  }

  // Generate single env file
  if (!(argv.app && argv.env)) {
    console.error(
      "Error: --app and --env are required when not using --all or --apply"
    );
    console.error("Use --help for usage information");
    return 1;
  }

  return await handleSingle(config, argv.app, argv.env);
}

// TODO: Refactor - Extract common file writing pattern
// The file writing logic (mkdir + writeFile + console.log) is duplicated here and in
// handleApply/handleAll. Consider creating a shared utility function to reduce duplication.
async function handleSingle(
  config: EnvConfig,
  appName: string,
  envName: string
): Promise<number> {
  const rootDir = process.cwd();
  const app = config.apps[appName];
  const env = app?.environments[envName];
  const envConfig = env ? getEnvironmentConfig(env as EnvConfigType) : {};

  const outputPath = determineOutputPath({
    appName,
    envName,
    app: app ?? {},
    envConfig,
    autoDetectedDir: null,
    rootDir,
  });

  const generateResult = generateEnvFile(config, appName, envName, outputPath);

  if (generateResult.isErr()) {
    console.error("Failed to generate env file:", generateResult.error.message);
    return 1;
  }

  // Write file
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generateResult.value, "utf-8");
  console.log(`✓ Generated: ${outputPath}`);

  return 0;
}
