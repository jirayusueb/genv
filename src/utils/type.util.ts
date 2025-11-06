export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isEnvFieldExtend(
  env: import("@/types").AppEnvironmentValue
): env is import("@/types").EnvFieldExtend {
  return "variables" in env && typeof env === "object";
}

