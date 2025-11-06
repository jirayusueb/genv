import { describe, expect, it } from "vitest";
import { isBoolean, isEnvFieldExtend, isNumber, isString } from "./type.util";

describe("type.util", () => {
  describe("isString", () => {
    it("should return true for string values", () => {
      expect(isString("hello")).toBe(true);
      expect(isString("")).toBe(true);
      expect(isString("123")).toBe(true);
    });

    it("should return false for non-string values", () => {
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
    });
  });

  describe("isNumber", () => {
    it("should return true for number values", () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-123)).toBe(true);
      expect(isNumber(123.45)).toBe(true);
      expect(isNumber(Number.NaN)).toBe(true);
      expect(isNumber(Number.POSITIVE_INFINITY)).toBe(true);
    });

    it("should return false for non-number values", () => {
      expect(isNumber("123")).toBe(false);
      expect(isNumber(true)).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber({})).toBe(false);
      expect(isNumber([])).toBe(false);
    });
  });

  describe("isBoolean", () => {
    it("should return true for boolean values", () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it("should return false for non-boolean values", () => {
      expect(isBoolean("true")).toBe(false);
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean(null)).toBe(false);
      expect(isBoolean(undefined)).toBe(false);
      expect(isBoolean({})).toBe(false);
      expect(isBoolean([])).toBe(false);
    });
  });

  describe("isEnvFieldExtend", () => {
    it("should return true for EnvFieldExtend objects", () => {
      expect(
        isEnvFieldExtend({
          variables: {
            PORT: "3000",
          },
        })
      ).toBe(true);

      expect(
        isEnvFieldExtend({
          variables: {
            PORT: "3000",
          },
          path: "/apps/backend",
        })
      ).toBe(true);
    });

    it("should return false for EnvField (legacy format)", () => {
      expect(
        isEnvFieldExtend({
          PORT: "3000",
          DATABASE_URL: "postgres://localhost:5432/mydb",
        })
      ).toBe(false);
    });

    // it("should return false for non-object values", () => {
    //   expect(isEnvFieldExtend(null)).toBe(false);
    //   expect(isEnvFieldExtend(undefined)).toBe(false);
    //   expect(isEnvFieldExtend("string")).toBe(false);
    //   expect(isEnvFieldExtend(123)).toBe(false);
    //   expect(isEnvFieldExtend(true)).toBe(false);
    //   // Note: Arrays are objects in JavaScript, but they don't have "variables" key
    //   // so isEnvFieldExtend will check for "variables" and return false
    //   expect(isEnvFieldExtend([])).toBe(false);
    // });

    it("should return false for objects without variables key", () => {
      expect(isEnvFieldExtend({ path: "/apps/backend" })).toBe(false);
      expect(isEnvFieldExtend({})).toBe(false);
    });
  });
});
