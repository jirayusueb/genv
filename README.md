# genv

A tool to generate `.env` files from `genv.config.yaml` with support for monorepos and shared variables.

## Features

- ✅ Generate env files from YAML configuration
- ✅ Support for monorepo (multiple apps/packages)
- ✅ Shared variables across all apps and environments
- ✅ Variable interpolation using `${shared:VARIABLE_NAME}` syntax
- ✅ Custom filename and path configuration per app/environment
- ✅ CLI interface for easy usage
- ✅ Initialize new config files with `--init`

## Installation

```bash
bun install
bun run build
```

## Usage

### Quick Start

1. **Initialize a new config file** (first time setup):

```bash
npx genv --init
```

This creates a `genv.config.yaml` file with example configuration.

2. **Edit the config file** to match your project structure:

Edit `genv.config.yaml` to define your apps, environments, and variables.

3. **Apply env files** to your monorepo structure:

```bash
npx genv --apply
```

This command will:

- Read `genv.config.yaml` from the current directory
- Auto-detect app directories in common monorepo structures (`packages/`, `apps/`, etc.)
- Generate `.env.{environment}` files in each app's directory (or use custom `filename`/`path` from config)
- Fall back to root directory if app directory not found

### Other Usage Examples

Generate all env files for all apps and environments:

```bash
bun run src/index.ts --all
# or
npx genv --all
```

Generate env file for a specific app and environment:

```bash
bun run src/index.ts --app frontend --env development
# or
npx genv --app frontend --env development
```

### CLI Options

```
-i, --init             Initialize a new genv.config.yaml file
-c, --config <path>    Path to config file (default: genv.config.yaml)
-a, --app <name>       Generate env for specific app
-e, --env <name>       Generate env for specific environment
-A, --all              Generate all env files for all apps and environments
--apply                Apply env files to monorepo structure (auto-detects app directories)
-h, --help             Show this help message
```

## Configuration

Create a `genv.config.yaml` file in your project root (or use `genv --init` to generate a template):

```yaml
# Shared variables that can be referenced across all apps
shared:
  variables:
    DATABASE_HOST: localhost
    API_URL: https://api.example.com

# Apps in the monorepo
apps:
  frontend:
    # Optional: default filename for all environments
    # filename: .env.local

    # Optional: default output path for all environments
    # path: apps/frontend

    environments:
      development:
        variables:
          # Simple format (string value)
          NODE_ENV: development
          
          # Extended format (object with value, comment, type)
          VITE_API_URL:
            value: ${shared:API_URL}
            comment: Backend API URL from shared config
            type: string
      
      production:
        variables:
          NODE_ENV: production
          VITE_API_URL:
            value: ${shared:API_URL}
            comment: Production API endpoint

  backend:
    # Optional app-level configuration
    path: apps/backend
    
    environments:
      development:
        variables:
          DATABASE_URL:
            value: postgres://${shared:DATABASE_HOST}:5432/mydb
            comment: Database connection string
```

### Shared Variables

Use `${shared:VARIABLE_NAME}` to reference shared variables:

```yaml
shared:
  variables:
    API_URL: https://api.example.com

apps:
  frontend:
    environments:
      development:
        variables:
          VITE_API_URL:
            value: ${shared:API_URL}
            comment: Backend API URL
            # Resolves to: https://api.example.com
```

### Variable Definition Formats

You can define variables in two ways:

**Format 1: Simple (string value)**
```yaml
variables:
  NODE_ENV: production
  PORT: "3000"
```

**Format 2: Extended (object with value, comment, type)**
```yaml
variables:
  DATABASE_URL:
    value: postgres://localhost:5432/db
    comment: Database connection string
    type: string
```

You can mix both formats in the same environment configuration. The `comment` field will be included as a comment annotation in the generated `.env` file. The `type` field is optional and available for future type validation.

## Monorepo Support

The tool supports monorepo structures by organizing configurations by app:

```yaml
apps:
  frontend:
    environments:
      development: { ... }
      production: { ... }

  backend:
    environments:
      development: { ... }
      production: { ... }

  mobile:
    environments:
      development: { ... }
      production: { ... }
```

### Custom Filename and Path

You can configure custom filenames and output paths at the app level or environment level:

**App-level configuration** (applies to all environments):

```yaml
apps:
  backend:
    filename: .env.local # Custom filename for all environments
    path: apps/backend # Custom output path
    environments:
      development: { ... }
      production: { ... }
```

**Environment-level configuration** (overrides app-level):

```yaml
apps:
  backend:
    filename: .env.local # Default filename
    environments:
      development:
        variables: { ... }
        filename: .env.development # Override filename for this environment
        path: apps/backend/config # Override path for this environment
```

**Path priority** (highest to lowest):

1. Environment-level `path`
2. App-level `path`
3. Auto-detected directory (in `--apply` mode)
4. Root directory (fallback)

**Filename priority** (highest to lowest):

1. Environment-level `filename`
2. App-level `filename`
3. `.env.{environment}` (default)

## Output

### Using `--apply` (Recommended for Monorepos)

When using `--apply`, the tool:

- Auto-detects app directories in common monorepo structures:
  - `packages/{app}/`
  - `apps/{app}/`
  - `{app}/` (root level)
  - `packages/@scope/{app}/` (for scoped packages)
- Generates `.env.{environment}` files in each app's directory
- Example: `packages/frontend/.env.development`, `apps/backend/.env.production`
- Falls back to root directory if app directory not found

### Using `--all`

When using `--all`, the tool generates files using:

- Config-defined `filename` and `path` if specified
- Default format: `{app}.{environment}.env` (e.g., `frontend.development.env`) in current directory

### Using `--app` and `--env`

When using `--app` and `--env`, the tool generates:

- Config-defined `filename` and `path` if specified
- Default: `.env.{environment}` in current directory

## Development

```bash
# Run in development mode
bun run dev

# Build
bun run build

# Run tests
bun test
```

## License

MIT
