# Root-Level Setup Example

This example demonstrates using `genv` in a simple project structure where environment files are generated at the root level, without a monorepo structure.

## Use Case

This pattern is ideal for:
- Single application projects
- Simple projects without monorepo structure
- Projects where you want `.env` files in the root directory
- Quick prototyping or small projects

## Directory Structure

```
examples/with-root/
├── genv.config.yaml
├── package.json
└── (generated .env files)
```

## Usage

1. **Generate environment files:**
   ```bash
   cd examples/with-root
   npx genv --apply --config genv.config.yaml
   ```

2. **This will generate:**
   - `.env.local` (for local environment)
   - `.env.development` (for development environment)
   - `.env` (for production environment)

   By setting `path: .` in the config, files are generated with the standard `.env.{environment}` format in the root directory.

## Key Points

- **`path: .` specified**: Setting `path: .` generates `.env` files directly in the root directory
- **Simple structure**: Perfect for single-app projects without monorepo structure
- **All environments**: Demonstrates local, development, and production
- **Standard naming**: Uses standard `.env.{environment}` naming conventions

## Generated Files

After running `genv --apply`, you'll see:

```
examples/with-root/
├── .env.local
├── .env.development
└── .env
```

The `path: .` configuration ensures files are generated in the root directory with standard naming conventions.

## Filename Conventions

genv automatically determines filenames:
- `local` environment → `.env.local`
- `production` environment → `.env`
- Other environments → `.env.{environment}` (e.g., `.env.development`)

## Example Output

**`.env.local`:**
```env
NODE_ENV=development
# Local PostgreSQL database connection
DATABASE_URL=postgres://user:pass@localhost:5432/local_db
# Local Redis connection
REDIS_URL=redis://localhost:6379
# Application server port
PORT=3000
```

**`.env` (production):**
```env
NODE_ENV=production
# Production database
DATABASE_URL=postgres://user:pass@localhost:5432/prod_db
# Local Redis connection
REDIS_URL=redis://localhost:6379
# Application server port
PORT=3000
# Production API endpoint
API_URL=https://api.example.com
```

## Comparison with Monorepo

| Feature | Root Setup | Monorepo Setup |
|---------|-----------|----------------|
| Structure | Single app at root | Multiple apps in `apps/` or `packages/` |
| Config | No `path` needed | Specify `path: apps/myapp` |
| Output | `.env` files at root | `.env` files in each app directory |
| Use Case | Simple projects | Complex multi-app projects |

