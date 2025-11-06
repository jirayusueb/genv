# Monorepo Example

This example demonstrates how to use `genv` in a monorepo structure with multiple applications.

## Directory Structure

```
examples/with-monorepo/
├── genv.config.yaml      # Configuration file
├── apps/
│   ├── frontend/         # Frontend app
│   └── backend/          # Backend app
└── packages/
    └── mobile/           # Mobile app
```

## Setup

1. **Navigate to this directory:**
   ```bash
   cd examples/with-monorepo
   ```

2. **Apply environment files:**
   ```bash
   npx genv --apply
   ```

   This will generate:
   - `apps/frontend/.env.local`
   - `apps/frontend/.env.development`
   - `apps/frontend/.env`
   - `apps/backend/.env.local`
   - `apps/backend/.env.development`
   - `apps/backend/.env`
   - `packages/mobile/.env.local` (if directory exists)
   - `packages/mobile/.env.development`
   - `packages/mobile/.env`

## Features Demonstrated

### 1. Custom Path Configuration

The `frontend` and `backend` apps use the `path` configuration to specify where env files should be generated:

```yaml
apps:
  frontend:
    path: apps/frontend
```

### 2. Shared Variables

All apps can reference shared variables using `${shared:VARIABLE_NAME}`:

```yaml
shared:
  variables:
    API_URL: https://api.example.com

apps:
  frontend:
    environments:
      production:
        VITE_API_URL: ${shared:API_URL}  # Resolves to the shared value
```

### 3. Environment-Specific Filenames

Genv automatically determines filenames based on environment names:
- `local` → `.env.local`
- `production` → `.env`
- Other environments → `.env.{environment}` (e.g., `.env.development`)

### 4. Auto-Detection

The `mobile` app doesn't specify a `path`, so genv will:
1. Try to auto-detect the directory (`packages/mobile/`, `apps/mobile/`, etc.)
2. Fall back to root directory if not found

## Generated Files

After running `genv --apply`, you'll see:

```
apps/
├── frontend/
│   ├── .env.local
│   ├── .env.development
│   └── .env
└── backend/
    ├── .env.local
    ├── .env.development
    └── .env

packages/
└── mobile/
    ├── .env.local
    ├── .env.development
    └── .env
```

## Usage

### Generate all files
```bash
npx genv --apply
```

### Generate for specific app/environment
```bash
npx genv --app frontend --env local
# Generates: apps/frontend/.env.local
```

### Generate all files (without --apply)
```bash
npx genv --all
# Generates files in root directory with format: {app}.{env}.env
```

## Notes

- The `.env.local` files are typically used for local development
- The `.env` files (production) are usually committed to version control
- The `.env.development` files are for development/staging environments
- Make sure to add `.env*` files to `.gitignore` (except `.env.example` or similar)

