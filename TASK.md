# Task Action Plan

This document summarizes all TODO items, performance improvements, library suggestions, and refactoring opportunities identified in the codebase.

## 📋 Table of Contents

- [Refactoring Tasks](#refactoring-tasks)
- [Performance Improvements](#performance-improvements)
- [Library Recommendations](#library-recommendations)
- [Logging Implementation](#logging-implementation)
- [Type Safety Improvements](#type-safety-improvements)
- [Error Handling Improvements](#error-handling-improvements)
- [Edge Cases](#edge-cases)
- [Test Coverage](#test-coverage)

---

## 🔧 Refactoring Tasks

### High Priority

#### 1. Extract Shared Utilities Module

**Files**: `src/cli.ts`, `src/generator.ts`

- **Issue**: `determineFilename()` is duplicated in both files
- **Action**: Create `src/utils/path.ts` with shared utilities
- **Files to modify**:
  - `src/cli.ts` (line 37-39)
  - `src/generator.ts` (line 163-161)

#### 2. Unify Path Resolution Logic

**Files**: `src/cli.ts`, `src/generator.ts`

- **Issue**: `determineOutputPath()` and `determineFilePath()` have similar logic
- **Action**: Create unified path resolution function in shared utils
- **Files to modify**:
  - `src/cli.ts` (line 62-65)
  - `src/generator.ts` (line 186-189)

#### 3. Extract File Writing Pattern

**Files**: `src/cli.ts`

- **Issue**: File writing pattern (`mkdir + writeFile + console.log`) duplicated in:
  - `handleApply()` (line 254-257)
  - `handleAll()` (line 305-310)
  - `handleSingle()` (line 436-438)
- **Action**: Create `writeEnvFile(path: string, content: string): Promise<void>` helper
- **Benefit**: Reduces duplication, improves maintainability

#### 4. Extract Path Resolution Helper

**Files**: `src/cli.ts`, `src/generator.ts`

- **Issue**: Repetitive `startsWith("/")` check and `resolve()` logic
- **Action**: Create `resolvePath(path: string, rootDir: string): string` helper
- **Benefit**: Reduces code duplication

### Medium Priority

#### 5. Break Down `runCLI` Function

**File**: `src/cli.ts` (line 328-333)

- **Issue**: Function is long and handles multiple concerns
- **Action**: Extract into smaller functions:
  - `setupYargs(args: string[])` - yargs configuration
  - `loadConfig(configPath: string)` - config loading and parsing
  - `routeCommand(argv, config)` - routing to appropriate handlers
- **Benefit**: Improves readability and testability

#### 6. Extract Value Formatting Logic

**File**: `src/generator.ts` (line 76-79)

- **Issue**: Complex value formatting logic (lines 105-114) in `generateEnvContent()`
- **Action**: Extract to `formatVariableValue(resolvedValue: string, originalValue: string | number | boolean, rawValue: string | number | boolean): string`
- **Benefit**: Improves readability and testability

#### 7. Extract Magic Strings to Constants

**File**: `src/cli.ts` (line 212-215)

- **Issue**: Directory names "packages", "apps" are hardcoded
- **Action**: Extract to constants:
  ```typescript
  const MONOREPO_DIRS = ["packages", "apps"] as const;
  ```
- **Benefit**: Better maintainability and configurability

---

## ⚡ Performance Improvements

### High Priority

#### 1. Parallel Path Checking

**File**: `src/cli.ts` (line 209-211)

- **Issue**: `findAppDirectory()` checks paths sequentially
- **Action**: Use `Promise.allSettled()` to check all paths in parallel
- **Impact**: Significant speedup for monorepos with many apps
- **Implementation**:
  ```typescript
  const results = await Promise.allSettled(
    possiblePaths.map((path) =>
      pathExists(path).then((exists) => ({ path, exists }))
    )
  );
  ```

#### 2. Batch File Writing

**Files**: `src/cli.ts` (`handleApply`, `handleAll`)

- **Issue**: Files are written sequentially in loops
- **Action**: Use `p-map` or `Promise.all()` for parallel writes with controlled concurrency
- **Impact**: Faster generation for multiple files
- **Library**: `p-map` (see Library Recommendations)

### Medium Priority

#### 3. Path Existence Caching

**File**: `src/cli.ts` (`findAppDirectory`)

- **Issue**: Repeated filesystem access for same paths
- **Action**: Implement caching with `lru-cache` or `node-cache`
- **Impact**: Reduces filesystem I/O for repeated operations
- **Library**: `lru-cache` (see Library Recommendations)

#### 4. Regex Compilation

**File**: `src/generator.ts` (line 5-7)

- **Issue**: Regex pattern is already optimized, but consider RegExp constructor if different flags needed
- **Action**: Current implementation is fine, but document for future use
- **Status**: Low priority - already optimized

---

## 📚 Library Recommendations

### Recommended Libraries

#### 1. `ora` - Terminal Spinners (CLI Progress)

**Purpose**: Elegant terminal spinners for async operations
**Use Case**: Show progress during file generation, path checking
**Installation**:

```bash
bun add ora
```

**Priority**: High - Improves user experience

#### 2. `chalk` - Terminal Colors (CLI Styling)

**Purpose**: Terminal string styling with colors
**Use Case**: Colored output for success (green), errors (red), info (blue)
**Installation**:

```bash
bun add chalk
```

**Priority**: High - Improves readability and professionalism

#### 3. `p-map` - Controlled Concurrency

**Purpose**: Parallel file operations with concurrency limits
**Use Case**: Batch file writing in `handleApply()` and `handleAll()`
**Installation**:

```bash
bun add p-map
```

**Example Usage**:

```typescript
import pMap from "p-map";

await pMap(
  files,
  async (file) => {
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content, "utf-8");
  },
  { concurrency: 10 }
); // Limit concurrent writes
```

#### 4. `lru-cache` - Path Caching

**Purpose**: Cache path existence checks
**Use Case**: `findAppDirectory()` to avoid repeated filesystem access
**Installation**:

```bash
bun add lru-cache
bun add -d @types/lru-cache
```

**Example Usage**:

```typescript
import { LRUCache } from "lru-cache";

const pathCache = new LRUCache<string, boolean>({
  max: 500, // Cache up to 500 paths
  ttl: 60_000, // 60 second TTL
});
```

#### 5. `fast-glob` (Optional)

**Purpose**: Fast file searching and glob matching
**Use Case**: Finding app directories in large monorepos
**Installation**:

```bash
bun add fast-glob
```

**Note**: Only needed if current path checking becomes a bottleneck

### Priority Order

1. **High**: `ora` + `chalk` - Immediate UX improvement, professional CLI appearance
2. **High**: `p-map` - Immediate impact on file writing performance
3. **Medium**: `lru-cache` - Useful for repeated path checks
4. **Low**: `fast-glob` - Only if current approach becomes insufficient

---

## 📝 Logging Implementation

### Current State

**Files**: `src/cli.ts`, `src/index.ts`

- **Issue**: Direct use of `console.log()` and `console.error()` throughout the codebase
- **Count**: 25+ console statements across multiple files
- **Problems**:
  - No log levels (info, warn, debug, error)
  - No structured logging
  - Difficult to test and mock
  - No log formatting or output control
  - Cannot disable logs in production or adjust verbosity

### Recommended Solution

#### Option 1: `pino` - Fast, Structured Logging (Recommended)

**Purpose**: High-performance structured logging with JSON output
**Use Case**: Production-ready logging with excellent performance
**Installation**:

```bash
bun add pino
bun add -d pino-pretty  # For development pretty printing
```

**Benefits**:

- Extremely fast (one of the fastest Node.js loggers)
- Structured JSON logging
- Child loggers for context
- Log levels (trace, debug, info, warn, error, fatal)
- Easy to test and mock

**Example Usage**:

```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

// Replace console.log
logger.info({ path: outputPath }, "Generated env file");

// Replace console.error
logger.error({ error: generateResult.error }, "Failed to generate env file");
```

#### Option 2: `winston` - Feature-Rich Logging

**Purpose**: Flexible logging with multiple transports
**Use Case**: Need for file logging, multiple outputs, or complex routing
**Installation**:

```bash
bun add winston
```

**Benefits**:

- Multiple transports (console, file, HTTP, etc.)
- Custom formatting
- Log rotation
- More features but heavier than pino

#### Option 3: Lightweight Custom Logger

**Purpose**: Minimal logging solution without external dependencies
**Use Case**: Keep bundle size small, simple logging needs
**Implementation**: Create `src/utils/logger.ts` with log levels and formatting

### Implementation Plan

#### Phase 1: Create Logger Module

**File**: `src/utils/logger.ts`

- Create logger instance with configurable log levels
- Support for development (pretty) and production (JSON) modes
- Export logger instance

#### Phase 2: Replace Console Statements

**Files to modify**:

- `src/cli.ts` (15+ console statements)
  - `console.log()` → `logger.info()`
  - `console.error()` → `logger.error()`
- `src/index.ts` (1 console.error)
  - `console.error()` → `logger.error()`

#### Phase 3: Add Structured Logging

- Add context to log messages (app name, env name, file paths)
- Use child loggers for operation context
- Add debug logs for development troubleshooting

#### Phase 4: Add CLI Options

- Add `--verbose` / `-v` flag for debug logging
- Add `--quiet` / `-q` flag to suppress info logs
- Add `--log-level` option for fine-grained control

### Example Refactoring

**Before**:

```typescript
console.log(`✓ Generated: ${outputPath}`);
console.error(
  `Failed to generate env for ${appName}.${envName}:`,
  generateResult.error.message
);
```

**After**:

```typescript
logger.info(
  { path: outputPath, app: appName, env: envName },
  "Generated env file"
);
logger.error(
  {
    app: appName,
    env: envName,
    error: generateResult.error.message,
  },
  "Failed to generate env file"
);
```

### Benefits

- **Testability**: Easy to mock logger in tests
- **Production Ready**: Structured logs for log aggregation tools
- **Debugging**: Log levels help filter noise
- **Performance**: pino is one of the fastest loggers
- **Maintainability**: Centralized logging configuration

### Priority

- **High**: Improves code quality, testability, and production readiness
- **Effort**: Medium - requires replacing all console statements and adding logger module

#### 5. Add CLI Progress Indicators and Colored Output

**Files**: `src/cli.ts` (`handleApply`, `handleAll`, `handleSingle`)

- **Issue**: No visual feedback during long-running operations (file generation, path checking)
- **Action**: Implement progress indicators and colored output using `ora` and `chalk`
- **Benefits**:
  - Better user experience with visual feedback
  - Colored output for better readability (success in green, errors in red)
  - Progress spinners for async operations
  - Professional CLI appearance

**Libraries**:

##### `ora` - Elegant Terminal Spinners

**Purpose**: Show progress spinners for async operations
**Installation**:

```bash
bun add ora
```

**Example Usage**:

```typescript
import ora from "ora";

const spinner = ora("Generating env files...").start();

try {
  // ... file generation logic
  spinner.succeed(`Generated ${count} env file(s)`);
} catch (error) {
  spinner.fail("Failed to generate env files");
}
```

##### `chalk` - Terminal String Styling

**Purpose**: Add colors and styling to terminal output
**Installation**:

```bash
bun add chalk
```

**Example Usage**:

```typescript
import chalk from "chalk";

// Success messages in green
console.log(chalk.green(`✓ Generated: ${outputPath}`));

// Error messages in red
console.error(chalk.red(`✗ Failed: ${error.message}`));

// Info messages in blue
console.log(chalk.blue("Processing configuration..."));

// Warning messages in yellow
console.warn(chalk.yellow("Warning: Config file already exists"));
```

**Implementation Plan**:

1. **Add Progress Spinners**:

   - Show spinner during `findAppDirectory()` operations
   - Show spinner during batch file generation in `handleApply()` and `handleAll()`
   - Show spinner during single file generation in `handleSingle()`

2. **Add Colored Output**:

   - Success messages: `chalk.green()` (✓ Generated, ✓ Applied)
   - Error messages: `chalk.red()` (✗ Failed, Error:)
   - Info messages: `chalk.blue()` or `chalk.cyan()` (Processing, Reading config)
   - Warning messages: `chalk.yellow()` (Warnings, Already exists)

3. **Replace Console Statements**:
   - Update all `console.log()` with colored output
   - Update all `console.error()` with red colored output
   - Add progress indicators for long operations

**Example Refactoring**:

**Before**:

```typescript
console.log(`✓ Generated: ${outputPath}`);
console.error(
  `Failed to generate env for ${appName}.${envName}:`,
  error.message
);
console.log(`\n✓ Applied ${generatedCount} env file(s) to monorepo`);
```

**After**:

```typescript
import ora from "ora";
import chalk from "chalk";

// With spinner
const spinner = ora(`Generating ${appName}.${envName}...`).start();
// ... generation logic
spinner.succeed(chalk.green(`Generated: ${outputPath}`));

// With colored output
console.error(
  chalk.red(`✗ Failed to generate env for ${appName}.${envName}:`),
  error.message
);
console.log(
  chalk.green(`\n✓ Applied ${generatedCount} env file(s) to monorepo`)
);
```

**Priority**:

- **High**: Significantly improves user experience and CLI professionalism
- **Effort**: Low-Medium - straightforward library integration

**Note**: Can be combined with logging implementation (pino) - use chalk for user-facing output, pino for structured logging

---

## 🔒 Type Safety Improvements

#### 1. Extract `EnvConfigType` to `types.ts`

**File**: `src/cli.ts` (line 8-9)

- **Issue**: Type duplicates logic from `types.ts`
- **Action**: Move `EnvConfigType` to `src/types.ts` and import it
- **Benefit**: Single source of truth, better maintainability

#### 2. Improve Path Type Narrowing

**Files**: `src/cli.ts` (line 26-29), `src/generator.ts` (line 153-145)

- **Issue**: Defensive type checking for path values that should always be strings
- **Action**: Review type system to ensure path is always string, remove unnecessary narrowing if possible
- **Benefit**: Cleaner code, better type safety

---

## 🚨 Error Handling Improvements

#### 1. Support Multiple Missing Variables

**File**: `src/generator.ts` (line 10-12)

- **Issue**: Only reports first missing variable
- **Action**: Collect all missing variables and report together
- **Benefit**: Better user experience, faster debugging
- **Example**:
  ```typescript
  // Collect all missing variables
  const missingVars: string[] = [];
  // ... collect during resolution
  if (missingVars.length > 0) {
    return err(new Error(`Missing variables: ${missingVars.join(", ")}`));
  }
  ```

#### 2. Add Error Codes or Structured Error Info

**File**: `src/parser.ts` (line 6-8)

- **Issue**: Error formatting is human-readable but lacks structure
- **Action**: Add error codes or structured information for programmatic handling
- **Benefit**: Better error handling in programmatic contexts
- **Example**:
  ```typescript
  interface ValidationError {
    code: "VALIDATION_ERROR";
    message: string;
    issues: Array<{ path: string[]; message: string }>;
  }
  ```

---

## ⚠️ Edge Cases

### Low Priority (Defensive Code)

#### 1. ZodError with Empty Issues Array

**File**: `src/parser.ts` (line 10-12)

- **Issue**: Branch is difficult to trigger (ZodError typically always has issues)
- **Action**: Evaluate if defensive check is necessary or can be removed
- **Status**: Documented, low priority

#### 2. ZodError Handling in mapErr

**File**: `src/parser.ts` (line 61-64)

- **Issue**: Branch is difficult to trigger (parseYamlSafe wraps errors)
- **Action**: Evaluate if defensive check is necessary or can be simplified
- **Status**: Documented, low priority

#### 3. Fallback for Unexpected Types

**File**: `src/generator.ts` (line 70-72)

- **Issue**: Should never be reached due to TypeScript types
- **Action**: Evaluate if can be removed or if additional type narrowing needed
- **Status**: Documented, low priority

#### 4. Non-string Path Values

**Files**: `src/cli.ts` (line 26-29), `src/generator.ts` (line 153-145)

- **Issue**: Defensive check for path values that should always be strings
- **Action**: Improve type system to ensure path is always string
- **Status**: Documented, medium priority

---

## 🧪 Test Coverage

#### 1. Improve Edge Case Test Coverage

**File**: `src/parser.test.ts` (line 235-240)

- **Issue**: Branches at lines 8-9 and 56-57 are difficult to trigger
- **Action**: Find way to reliably trigger these branches or evaluate if they're necessary
- **Status**: Documented, low priority
- **Current Coverage**: 90.47% branch coverage (target: 100%)

---

## 📊 Implementation Priority

### Phase 1: High Impact, Low Effort

1. ✅ Parallel path checking (native Promise.allSettled)
2. ✅ Extract file writing pattern
3. ✅ Extract shared utilities (determineFilename)

### Phase 2: High Impact, Medium Effort

4. ✅ Install and implement `p-map` for batch file writing
5. ✅ Unify path resolution logic
6. ✅ Extract `EnvConfigType` to types.ts
7. ✅ Implement structured logging (replace console statements)
8. ✅ Add CLI progress indicators and colored output (ora, chalk)

### Phase 3: Medium Impact, Medium Effort

9. ✅ Break down `runCLI` function
10. ✅ Extract value formatting logic
11. ✅ Improve error handling (multiple missing variables)

### Phase 4: Low Impact, Low Effort

12. ✅ Extract magic strings to constants
13. ✅ Install and implement `lru-cache` for path caching
14. ✅ Add error codes/structured errors

### Phase 5: Edge Cases & Cleanup

15. ✅ Evaluate and potentially remove defensive edge case checks
16. ✅ Improve test coverage for edge cases
17. ✅ Improve type system to remove unnecessary narrowing

---

## 📝 Notes

- All performance improvements should be benchmarked before and after implementation
- Refactoring tasks should maintain 100% test coverage
- Library additions should be evaluated for bundle size impact
- Edge case handling should be evaluated for actual necessity vs. defensive programming

---

## 🔗 Related Files

- `src/cli.ts` - Main CLI implementation
- `src/generator.ts` - Environment file generation
- `src/parser.ts` - YAML parsing and validation
- `src/types.ts` - Type definitions
- `src/parser.test.ts` - Parser tests

---

**Last Updated**: Generated from codebase analysis
**Total TODOs**: 22 items across 4 files (including logging and CLI improvements)
