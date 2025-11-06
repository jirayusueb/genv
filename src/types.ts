import { z } from "zod";

const SharedVariablesSchema = z
  .object({
    variables: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe("Shared variables that can be referenced across all apps"),
  })
  .optional()
  .describe("Shared configuration section");

// Variable value can be a string, number, boolean, or an object with value, comment, type
const VariableValueSchema: z.ZodType<
  | string
  | number
  | boolean
  | { value: string | number | boolean; comment?: string; type?: string }
> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({
    value: z.union([z.string(), z.number(), z.boolean()]),
    comment: z
      .string()
      .optional()
      .describe("Comment/annotation for this variable"),
    type: z
      .string()
      .optional()
      .describe(
        "Type hint for this variable (e.g., 'string', 'number', 'boolean')"
      ),
  }),
]);

// Support both old format (flat object) and new format (with variables key)
const AppEnvironmentValueSchema: z.ZodType<
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
    }
> = z.union([
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), // Legacy format: { VAR: "value" } or { VAR: 3000 } or { VAR: true }
  z.object({
    variables: z.record(
      z.string().min(1, "Variable name cannot be empty"),
      VariableValueSchema
    ),
    path: z
      .string()
      .optional()
      .describe("Custom output path for the env file (e.g., '/apps/backend')"),
  }),
]);

const AppEnvironmentSchema = z
  .record(
    z.string().min(1, "Environment name cannot be empty"),
    AppEnvironmentValueSchema
  )
  .refine((envs) => Object.keys(envs).length > 0, {
    message: "At least one environment must be defined",
  });

const AppSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      "Default output path for all environments (e.g., '/apps/backend')"
    ),
  environments: AppEnvironmentSchema.describe(
    "Environment-specific variable configurations"
  ),
});

export const EnvConfigSchema = z
  .object({
    shared: SharedVariablesSchema,
    apps: z
      .record(z.string().min(1, "App name cannot be empty"), AppSchema)
      .refine((apps) => Object.keys(apps).length > 0, {
        message: "At least one app must be defined",
      })
      .describe("Apps in the monorepo"),
  })
  .strict()
  .refine(
    (data) => {
      // Validate that apps have at least one environment
      return Object.values(data.apps).every(
        (app) => Object.keys(app.environments).length > 0
      );
    },
    {
      message: "Each app must have at least one environment defined",
    }
  );

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

export type GenerateOptions = {
  app?: string;
  environment?: string;
  outputDir?: string;
  configPath?: string;
};
