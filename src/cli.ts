import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import yargs from "yargs";
import { DEFAULT_CONFIG } from "@/constants/config.constant";
import { generateAllEnvFiles, generateEnvFile } from "@/generator";
import type { EnvConfig } from "@/models/env-config.model";
import { parseConfig } from "@/parser";
import type { AppEnvironmentValue } from "@/types";
import {
  determineOutputPath,
  findAppDirectory,
  pathExists,
} from "@/utils/path.util";
import { isEnvFieldExtend } from "@/utils/type.util";

function getEnvironmentConfig(env: AppEnvironmentValue): { path?: string } {
  // Check if it's the new format (EnvFieldExtend) which has a path property
  // The Zod schema validates path as z.string().optional(), so it's guaranteed to be a string if present
  if (isEnvFieldExtend(env)) {
    // Type assertion is safe here because:
    // 1. The type guard narrows to EnvFieldExtend
    // 2. EnvFieldExtend.path is defined as string | undefined
    // 3. Zod schema validates path as z.string().optional()
    return {
      path: env.path as string | undefined,
    };
  }

  return {};
}

async function handleInit(configPath: string): Promise<number> {
  // Check if config file already exists
  if (await pathExists(configPath)) {
    console.error(
      `Error: Config file '${configPath}' already exists. Remove it first if you want to reinitialize.`
    );
    return 1;
  }

  try {
    await writeFile(configPath, DEFAULT_CONFIG, "utf-8");
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

// TODO: Refactor - Extract file writing logic to shared utility
// The file writing pattern (mkdir + writeFile + console.log) is duplicated in handleApply,
// handleAll, and handleSingle. Consider creating a helper function like
// `writeEnvFile(path: string, content: string): Promise<void>` to reduce duplication.
async function handleApply(
  config: EnvConfig,
  rootDir: string
): Promise<number> {
  let generatedCount = 0;

  for (const appName of config.getAppNames()) {
    const app = config.getApp(appName);
    if (!app) {
      continue;
    }

    // Try to find app directory in monorepo structure
    const appDir = await findAppDirectory(appName, rootDir);

    for (const envName of config.getEnvironmentNames(appName)) {
      const env = config.getEnvironment(appName, envName);
      if (!env) {
        continue;
      }
      const envConfig = getEnvironmentConfig(env);
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
  const app = config.getApp(appName);
  const env = config.getEnvironment(appName, envName);
  const envConfig = env ? getEnvironmentConfig(env) : {};

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
