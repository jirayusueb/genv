import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCLI } from "./cli";

// Mock file system operations
vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock process.cwd
const mockCwd = vi.fn(() => "/test/root");

// Mock console methods - we'll check their calls
let consoleLog: ReturnType<typeof vi.spyOn>;
let consoleError: ReturnType<typeof vi.spyOn>;
let processExit: ReturnType<typeof vi.spyOn>;

describe("runCLI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.cwd
    Object.defineProperty(process, "cwd", {
      value: mockCwd,
      writable: true,
    });
    // Setup console spies
    // biome-ignore lint/suspicious/noEmptyBlockStatements: Mock implementation intentionally empty
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    // biome-ignore lint/suspicious/noEmptyBlockStatements: Mock implementation intentionally empty
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    processExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never) as ReturnType<
      typeof vi.spyOn
    >;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("--init", () => {
    it("should create config file when it does not exist", async () => {
      vi.mocked(access).mockRejectedValueOnce(new Error("File not found"));
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--init"]);

      expect(exitCode).toBe(0);
      expect(access).toHaveBeenCalledWith("genv.config.yaml");
      expect(writeFile).toHaveBeenCalledWith(
        "genv.config.yaml",
        expect.stringContaining("# genv Configuration File"),
        "utf-8"
      );
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Created config file")
      );
    });

    it("should return error when config file already exists", async () => {
      vi.mocked(access).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--init"]);

      expect(exitCode).toBe(1);
      expect(access).toHaveBeenCalledWith("genv.config.yaml");
      expect(writeFile).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("already exists")
      );
    });

    it("should use custom config path", async () => {
      vi.mocked(access).mockRejectedValueOnce(new Error("File not found"));
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--init", "--config", "custom.yaml"]);

      expect(exitCode).toBe(0);
      expect(access).toHaveBeenCalledWith("custom.yaml");
      expect(writeFile).toHaveBeenCalledWith(
        "custom.yaml",
        expect.any(String),
        "utf-8"
      );
    });

    it("should handle write file errors", async () => {
      vi.mocked(access).mockRejectedValueOnce(new Error("File not found"));
      vi.mocked(writeFile).mockRejectedValueOnce(
        new Error("Permission denied")
      );

      const exitCode = await runCLI(["--init"]);

      expect(exitCode).toBe(1);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create config file"),
        "Permission denied"
      );
    });
  });

  describe("--apply", () => {
    const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
    `;

    it("should apply env files to monorepo", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access)
        .mockResolvedValueOnce(undefined) // config file exists
        .mockResolvedValueOnce(undefined); // app directory exists
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--apply"]);

      expect(exitCode).toBe(0);
      expect(readFile).toHaveBeenCalledWith("genv.config.yaml", "utf-8");
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Generated:")
      );
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Applied")
      );
    });

    it("should handle errors when generating env files", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access)
        .mockResolvedValueOnce(undefined) // config file exists
        .mockRejectedValueOnce(new Error("Not found")); // app directory not found

      const exitCode = await runCLI(["--apply"]);

      // Should still return 0 even if some files fail (continue on error)
      expect(exitCode).toBe(0);
    });
  });

  describe("--all", () => {
    const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
      production:
        variables:
          PORT: "8080"
    `;

    it("should generate all env files", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const exitCode = await runCLI(["--all"]);

      expect(exitCode).toBe(0);
      expect(readFile).toHaveBeenCalledWith("genv.config.yaml", "utf-8");
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Generated:")
      );
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Generated 2 env file(s)")
      );
    });

    it("should handle errors when generating all files", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(`
apps:
  backend:
    environments:
      local:
        variables:
          MISSING: "\${shared:NOT_FOUND}"
      `);
      vi.mocked(access).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--all"]);

      expect(exitCode).toBe(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to generate env files:",
        expect.stringContaining("Failed to generate env for backend.local")
      );
    });
  });

  describe("--app and --env", () => {
    const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
    `;

    it("should generate single env file", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--app", "backend", "--env", "local"]);

      expect(exitCode).toBe(0);
      expect(readFile).toHaveBeenCalledWith("genv.config.yaml", "utf-8");
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Generated:")
      );
    });

    it("should return error when app or env is missing", async () => {
      // When no action is specified, help is shown (not an error message)
      const exitCode1 = await runCLI(["--app", "backend"]);
      expect(exitCode1).toBe(1);
      // Help is shown via yargs, which outputs to console

      vi.clearAllMocks();

      const exitCode2 = await runCLI(["--env", "local"]);
      expect(exitCode2).toBe(1);
      // Help is shown via yargs
    });

    it("should handle errors when generating single file", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(`
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
      `);
      vi.mocked(access).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--app", "frontend", "--env", "local"]);

      expect(exitCode).toBe(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to generate env file:",
        expect.stringContaining("App 'frontend' not found")
      );
    });
  });

  describe("error handling", () => {
    it("should show help when no action specified", async () => {
      const exitCode = await runCLI([]);

      expect(exitCode).toBe(1);
      // yargs showHelp is called internally
    });

    it("should handle config file read errors", async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error("File not found"));

      // process.exit will be called, so we catch it
      try {
        await runCLI(["--all"]);
      } catch {
        // process.exit throws, but we've mocked it
      }

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error reading config file"),
        "File not found"
      );
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it("should handle config parse errors", async () => {
      vi.mocked(readFile).mockResolvedValueOnce("invalid: yaml: [");

      const exitCode = await runCLI(["--all"]);

      expect(exitCode).toBe(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to parse config:",
        expect.any(String)
      );
    });

    it("should use custom config path", async () => {
      const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
      `;

      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI([
        "--config",
        "custom.yaml",
        "--app",
        "backend",
        "--env",
        "local",
      ]);

      expect(exitCode).toBe(0);
      expect(readFile).toHaveBeenCalledWith("custom.yaml", "utf-8");
    });
  });

  describe("findAppDirectory logic (tested through --apply)", () => {
    const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
  "@org/app":
    environments:
      local:
        variables:
          PORT: "3000"
    `;

    it("should find app in packages directory", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access)
        .mockResolvedValueOnce(undefined) // config exists
        .mockResolvedValueOnce(undefined); // packages/backend exists
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--apply"]);

      expect(exitCode).toBe(0);
      // Check that access was called with a path containing packages/backend
      const accessCalls = vi.mocked(access).mock.calls;
      const hasPackagesBackend = accessCalls.some((call) =>
        String(call[0]).includes("packages/backend")
      );
      expect(hasPackagesBackend).toBe(true);
    });

    it("should find app in apps directory when packages not found", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access)
        .mockResolvedValueOnce(undefined) // config exists
        .mockRejectedValueOnce(new Error("Not found")) // packages/backend not found
        .mockResolvedValueOnce(undefined); // apps/backend exists
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--apply"]);

      expect(exitCode).toBe(0);
      // Verify that the function successfully found a directory and generated files
      expect(writeFile).toHaveBeenCalled();
      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Generated:")
      );
    });

    it("should find scoped package", async () => {
      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access)
        .mockResolvedValueOnce(undefined) // config exists
        .mockRejectedValueOnce(new Error("Not found")) // packages/@org/app not found
        .mockRejectedValueOnce(new Error("Not found")) // apps/@org/app not found
        .mockResolvedValueOnce(undefined); // @org/app exists
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--apply"]);

      expect(exitCode).toBe(0);
    });
  });

  describe("path determination logic", () => {
    it("should use env-level path when specified", async () => {
      const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
        path: "apps/backend"
      `;

      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--app", "backend", "--env", "local"]);

      expect(exitCode).toBe(0);
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      if (writeCall) {
        const filePath = writeCall[0] as string;
        expect(filePath).toContain("apps/backend");
        expect(filePath).toContain(".env.local");
      }
    });

    it("should use app-level path when env path not specified", async () => {
      const mockConfigContent = `
apps:
  backend:
    path: "apps/backend"
    environments:
      local:
        variables:
          PORT: "3000"
      `;

      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--app", "backend", "--env", "local"]);

      expect(exitCode).toBe(0);
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      if (writeCall) {
        const filePath = writeCall[0] as string;
        expect(filePath).toContain("apps/backend");
      }
    });

    it("should use absolute paths correctly", async () => {
      const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
        path: "/absolute/path"
      `;

      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--app", "backend", "--env", "local"]);

      expect(exitCode).toBe(0);
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      if (writeCall) {
        const filePath = writeCall[0] as string;
        expect(filePath).toContain("/absolute/path");
      }
    });

    it("should determine correct filename for production", async () => {
      const mockConfigContent = `
apps:
  backend:
    environments:
      production:
        variables:
          PORT: "3000"
      `;

      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI([
        "--app",
        "backend",
        "--env",
        "production",
      ]);

      expect(exitCode).toBe(0);
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      if (writeCall) {
        const filePath = writeCall[0] as string;
        expect(filePath).toContain(".env");
        expect(filePath).not.toContain(".env.production");
      }
    });

    it("should determine correct filename for local", async () => {
      const mockConfigContent = `
apps:
  backend:
    environments:
      local:
        variables:
          PORT: "3000"
      `;

      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI(["--app", "backend", "--env", "local"]);

      expect(exitCode).toBe(0);
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      if (writeCall) {
        const filePath = writeCall[0] as string;
        // When no path is specified, uses default format: appName.envName.env
        expect(filePath).toContain("backend.local.env");
      }
    });

    it("should determine correct filename for other environments", async () => {
      const mockConfigContent = `
apps:
  backend:
    environments:
      development:
        variables:
          PORT: "3000"
      `;

      vi.mocked(readFile).mockResolvedValueOnce(mockConfigContent);
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);

      const exitCode = await runCLI([
        "--app",
        "backend",
        "--env",
        "development",
      ]);

      expect(exitCode).toBe(0);
      const writeCall = vi.mocked(writeFile).mock.calls[0];
      if (writeCall) {
        const filePath = writeCall[0] as string;
        // When no path is specified, uses default format: appName.envName.env
        expect(filePath).toContain("backend.development.env");
      }
    });
  });
});
