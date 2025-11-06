import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  determineFilename,
  determineFilePath,
  determineOutputPath,
  findAppDirectory,
  pathExists,
} from "./path.util";

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
}));

import { access } from "node:fs/promises";

describe("path.util", () => {
  describe("determineFilename", () => {
    it("should return .env.local for 'local' environment", () => {
      expect(determineFilename("local")).toBe(".env.local");
    });

    it("should return .env for 'production' environment", () => {
      expect(determineFilename("production")).toBe(".env");
    });

    it("should return .env.{envName} for other environments", () => {
      expect(determineFilename("development")).toBe(".env.development");
      expect(determineFilename("staging")).toBe(".env.staging");
      expect(determineFilename("test")).toBe(".env.test");
    });
  });

  describe("determineFilePath", () => {
    const rootDir = "/project";
    const outputDir = "/output";

    it("should use env-level path when provided (absolute)", () => {
      const config = {
        appName: "backend",
        envName: "development",
        app: {},
        envConfig: { path: "/custom/env" },
        outputDir,
        rootDir,
      };
      const result = determineFilePath(config);
      expect(result).toBe("/custom/env/.env.development");
    });

    it("should use env-level path when provided (relative)", () => {
      const config = {
        appName: "backend",
        envName: "local",
        app: {},
        envConfig: { path: "custom/env" },
        outputDir,
        rootDir,
      };
      const result = determineFilePath(config);
      expect(result).toBe("/project/custom/env/.env.local");
    });

    it("should use app-level path when env-level path is not provided (absolute)", () => {
      const config = {
        appName: "backend",
        envName: "production",
        app: { path: "/apps/backend" },
        envConfig: {},
        outputDir,
        rootDir,
      };
      const result = determineFilePath(config);
      expect(result).toBe("/apps/backend/.env");
    });

    it("should use app-level path when env-level path is not provided (relative)", () => {
      const config = {
        appName: "backend",
        envName: "development",
        app: { path: "apps/backend" },
        envConfig: {},
        outputDir,
        rootDir,
      };
      const result = determineFilePath(config);
      expect(result).toBe("/project/apps/backend/.env.development");
    });

    it("should use default outputDir when no paths are provided", () => {
      const config = {
        appName: "backend",
        envName: "staging",
        app: {},
        envConfig: {},
        outputDir,
        rootDir,
      };
      const result = determineFilePath(config);
      expect(result).toBe("/output/backend.staging.env");
    });

    it("should prioritize env-level path over app-level path", () => {
      const config = {
        appName: "backend",
        envName: "development",
        app: { path: "/apps/backend" },
        envConfig: { path: "/custom/env" },
        outputDir,
        rootDir,
      };
      const result = determineFilePath(config);
      expect(result).toBe("/custom/env/.env.development");
    });
  });

  describe("determineOutputPath", () => {
    const rootDir = "/project";

    it("should use env-level path when provided (absolute)", () => {
      const options = {
        appName: "backend",
        envName: "development",
        app: {},
        envConfig: { path: "/custom/env" },
        autoDetectedDir: null,
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toBe("/custom/env/.env.development");
    });

    it("should use env-level path when provided (relative)", () => {
      const options = {
        appName: "backend",
        envName: "local",
        app: {},
        envConfig: { path: "custom/env" },
        autoDetectedDir: null,
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toContain("/custom/env/.env.local");
      expect(result).toContain("project");
    });

    it("should use app-level path when env-level path is not provided (absolute)", () => {
      const options = {
        appName: "backend",
        envName: "production",
        app: { path: "/apps/backend" },
        envConfig: {},
        autoDetectedDir: null,
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toBe("/apps/backend/.env");
    });

    it("should use app-level path when env-level path is not provided (relative)", () => {
      const options = {
        appName: "backend",
        envName: "development",
        app: { path: "apps/backend" },
        envConfig: {},
        autoDetectedDir: null,
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toContain("/apps/backend/.env.development");
      expect(result).toContain("project");
    });

    it("should use autoDetectedDir when no paths are provided", () => {
      const options = {
        appName: "backend",
        envName: "staging",
        app: {},
        envConfig: {},
        autoDetectedDir: "/auto/detected",
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toBe("/auto/detected/.env.staging");
    });

    it("should use rootDir fallback when no paths or autoDetectedDir are provided", () => {
      const options = {
        appName: "backend",
        envName: "test",
        app: {},
        envConfig: {},
        autoDetectedDir: null,
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toBe("/project/backend.test.env");
    });

    it("should prioritize env-level path over app-level path", () => {
      const options = {
        appName: "backend",
        envName: "development",
        app: { path: "/apps/backend" },
        envConfig: { path: "/custom/env" },
        autoDetectedDir: "/auto/detected",
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toBe("/custom/env/.env.development");
    });

    it("should prioritize app-level path over autoDetectedDir", () => {
      const options = {
        appName: "backend",
        envName: "development",
        app: { path: "/apps/backend" },
        envConfig: {},
        autoDetectedDir: "/auto/detected",
        rootDir,
      };
      const result = determineOutputPath(options);
      expect(result).toBe("/apps/backend/.env.development");
    });
  });

  describe("pathExists", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return true when path exists", async () => {
      (access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const result = await pathExists("/some/path");
      expect(result).toBe(true);
      expect(access).toHaveBeenCalledWith("/some/path");
    });

    it("should return false when path does not exist", async () => {
      (access as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("ENOENT")
      );
      const result = await pathExists("/nonexistent/path");
      expect(result).toBe(false);
      expect(access).toHaveBeenCalledWith("/nonexistent/path");
    });

    it("should return false for any error", async () => {
      (access as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Permission denied")
      );
      const result = await pathExists("/restricted/path");
      expect(result).toBe(false);
    });
  });

  describe("findAppDirectory", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should find app in packages directory", async () => {
      (access as ReturnType<typeof vi.fn>).mockImplementation(
        (path: string) => {
          if (path === "/project/packages/backend") {
            return Promise.resolve(undefined);
          }
          return Promise.reject(new Error("not found"));
        }
      );

      const result = await findAppDirectory("backend", "/project");
      expect(result).toBe("/project/packages/backend");
    });

    it("should find app in apps directory", async () => {
      (access as ReturnType<typeof vi.fn>).mockImplementation(
        (path: string) => {
          if (path === "/project/apps/frontend") {
            return Promise.resolve(undefined);
          }
          return Promise.reject(new Error("not found"));
        }
      );

      const result = await findAppDirectory("frontend", "/project");
      expect(result).toBe("/project/apps/frontend");
    });

    it("should find app in root directory", async () => {
      (access as ReturnType<typeof vi.fn>).mockImplementation(
        (path: string) => {
          if (path === "/project/standalone") {
            return Promise.resolve(undefined);
          }
          return Promise.reject(new Error("not found"));
        }
      );

      const result = await findAppDirectory("standalone", "/project");
      expect(result).toBe("/project/standalone");
    });

    it("should return null when app is not found", async () => {
      (access as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("not found")
      );

      const result = await findAppDirectory("nonexistent", "/project");
      expect(result).toBeNull();
    });

    it("should handle scoped packages (e.g., @org/app-name)", async () => {
      (access as ReturnType<typeof vi.fn>).mockImplementation(
        (path: string) => {
          // For scoped packages, standard paths are checked first
          // Then scoped paths are checked (which are the same paths since scope includes @)
          // This test verifies that scoped packages can be found in packages directory
          if (path === "/project/packages/@org/app-name") {
            return Promise.resolve(undefined);
          }
          return Promise.reject(new Error("not found"));
        }
      );

      const result = await findAppDirectory("@org/app-name", "/project");
      expect(result).toBe("/project/packages/@org/app-name");
    });

    it("should check scoped package paths when app name starts with @", async () => {
      (access as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("not found")
      );

      const result = await findAppDirectory("@scope/name", "/project");
      expect(result).toBeNull();
    });

    it("should not check scoped paths for invalid scoped package names", async () => {
      (access as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("not found")
      );

      const result = await findAppDirectory("@invalid", "/project");
      expect(result).toBeNull();
    });

    it("should prioritize packages over apps directory", async () => {
      (access as ReturnType<typeof vi.fn>).mockImplementation(
        (path: string) => {
          if (path === "/project/packages/myapp") {
            return Promise.resolve(undefined);
          }
          return Promise.reject(new Error("not found"));
        }
      );

      const result = await findAppDirectory("myapp", "/project");
      expect(result).toBe("/project/packages/myapp");
    });
  });
});
