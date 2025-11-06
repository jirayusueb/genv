import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the CLI module before importing index
vi.mock("./cli", () => ({
  runCLI: vi.fn(),
}));

describe("index.ts main entry point", () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let mockProcessExit: ReturnType<typeof vi.fn>;
  let mockConsoleError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Save original values
    originalArgv = [...process.argv];
    originalExit = process.exit;
    originalConsoleError = console.error;

    // Create fresh mocks
    mockProcessExit = vi.fn();
    mockConsoleError = vi.fn();

    // Mock process.exit
    process.exit = mockProcessExit as unknown as typeof process.exit;

    // Mock console.error
    console.error = mockConsoleError;

    // Clear module cache to allow fresh imports
    vi.resetModules();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.exit = originalExit;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it("should call runCLI with process.argv.slice(2) and exit with returned code", async () => {
    // Dynamic import to get fresh module
    const { runCLI } = await import("./cli");
    const mockRunCLI = vi.mocked(runCLI);

    // Set up mocks before importing index
    mockRunCLI.mockResolvedValueOnce(0);
    process.argv = ["node", "index.js", "--init"];

    // Import index module - this will execute main()
    await import("./index");

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify runCLI was called with correct arguments
    expect(mockRunCLI).toHaveBeenCalledWith(["--init"]);
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });

  it("should handle errors in runCLI and exit with code 1", async () => {
    // Dynamic import to get fresh module
    const { runCLI } = await import("./cli");
    const mockRunCLI = vi.mocked(runCLI);

    const testError = new Error("Test error");
    mockRunCLI.mockRejectedValueOnce(testError);
    process.argv = ["node", "index.js", "--test"];

    // Import index module - this will execute main() and trigger error
    await import("./index");

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify error handling
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Unexpected error:",
      testError
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should pass all command line arguments except first two to runCLI", async () => {
    const { runCLI } = await import("./cli");
    const mockRunCLI = vi.mocked(runCLI);

    mockRunCLI.mockResolvedValueOnce(0);
    process.argv = ["node", "index.js", "--app", "backend", "--env", "local"];

    await import("./index");

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify runCLI received correct arguments (argv.slice(2))
    expect(mockRunCLI).toHaveBeenCalledWith([
      "--app",
      "backend",
      "--env",
      "local",
    ]);
  });

  it("should handle empty command line arguments", async () => {
    const { runCLI } = await import("./cli");
    const mockRunCLI = vi.mocked(runCLI);

    mockRunCLI.mockResolvedValueOnce(1);
    process.argv = ["node", "index.js"];

    await import("./index");

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify runCLI was called with empty array
    expect(mockRunCLI).toHaveBeenCalledWith([]);
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });
});
