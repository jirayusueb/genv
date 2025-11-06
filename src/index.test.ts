import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create mock function using vi.hoisted to make it accessible in both mock and tests
const { mockRunCLI } = await vi.hoisted(() => ({
  mockRunCLI: vi.fn(),
}));

// Mock the CLI module
vi.mock("./cli", () => ({
  runCLI: mockRunCLI,
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

    // Clear all mocks
    vi.clearAllMocks();
    mockRunCLI.mockClear();
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.exit = originalExit;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it("should call runCLI with process.argv.slice(2) and exit with returned code", async () => {
    // Set up mocks before importing index
    mockRunCLI.mockResolvedValueOnce(0);
    process.argv = ["node", "index.js", "--init"];

    // Import index module - this will execute main()
    // Need to clear the module cache to re-import
    vi.resetModules();
    await import("./index");

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify runCLI was called with correct arguments
    expect(mockRunCLI).toHaveBeenCalledWith(["--init"]);
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });

  it("should handle errors in runCLI and exit with code 1", async () => {
    const testError = new Error("Test error");
    mockRunCLI.mockRejectedValueOnce(testError);
    process.argv = ["node", "index.js", "--test"];

    // Import index module - this will execute main() and trigger error
    // Need to clear the module cache to re-import
    vi.resetModules();
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
    mockRunCLI.mockResolvedValueOnce(0);
    process.argv = ["node", "index.js", "--app", "backend", "--env", "local"];

    // Need to clear the module cache to re-import
    vi.resetModules();
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
    mockRunCLI.mockResolvedValueOnce(1);
    process.argv = ["node", "index.js"];

    // Need to clear the module cache to re-import
    vi.resetModules();
    await import("./index");

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify runCLI was called with empty array
    expect(mockRunCLI).toHaveBeenCalledWith([]);
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });
});
