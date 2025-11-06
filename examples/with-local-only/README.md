# Local-Only Environment Example

This example demonstrates a simple setup where you only need local development environment variables.

## Features

- Only `local` environment configured
- Generates `.env.local` files (following the naming convention: `local` → `.env.local`)
- Simple configuration without multiple environments

## Directory Structure

```
examples/with-local-only/
├── genv.config.yaml
├── apps/
│   ├── backend/
│   └── frontend/
```

## Usage

1. **Generate local environment files:**
   ```bash
   cd examples/with-local-only
   npx genv --apply --config genv.config.yaml
   ```

2. **This will generate:**
   - `apps/backend/.env.local`
   - `apps/frontend/.env.local`

## Why Local-Only?

This pattern is useful when:
- You only need local development setup
- Production/staging environments are managed separately
- You want to keep the config simple and focused
- Team members only need local environment configuration

## Generated Files

After running `genv --apply`, you'll see:

```
apps/
├── backend/
│   └── .env.local
└── frontend/
    └── .env.local
```

## Note on Filenames

The `local` environment automatically generates `.env.local` files, following genv's naming convention:
- `local` → `.env.local`
- `production` → `.env`
- Other environments → `.env.{environment}`

