# genv

> Environment variable manager for monorepos with shared variable support

**genv** is a CLI tool that generates `.env` files from a centralized YAML configuration. Perfect for monorepos where multiple applications need consistent environment variable management with shared configuration.

## ✨ Features

- 🎯 **Centralized Configuration** - Manage all environment variables in one `genv.config.yaml` file
- 🔄 **Shared Variables** - Define common variables once and reference them across all apps using `${shared:VARIABLE_NAME}`
- 📦 **Monorepo Support** - Organize variables by app with automatic directory detection
- 💬 **Comment Annotations** - Add comments to variables that appear in generated `.env` files
- 🎨 **Flexible Formats** - Use simple string values or extended objects with comments and type hints
- 🚀 **Smart Auto-Detection** - Automatically finds app directories in common monorepo structures
- ⚡ **Zero Runtime** - No dependencies required in your project, works with `npx`

## 📦 Installation

### Using npx (Recommended)

No installation needed! Use directly with npx:

```bash
npx @jirayusueb/genv --help
```

### Global Installation

```bash
npm install -g @jirayusueb/genv
```

### Local Installation (for development)

```bash
bun install
bun run build
```

## 🚀 Quick Start

### 1. Initialize Configuration

Create a new `genv.config.yaml` file:

```bash
npx @jirayusueb/genv --init
```

This creates a template configuration file with examples.

### 2. Configure Your Variables

Edit `genv.config.yaml` to define your apps, environments, and variables:

```yaml
shared:
  variables:
    DATABASE_HOST: localhost
    API_URL: https://api.example.com

apps:
  frontend:
    environments:
      production:
        variables:
          NODE_ENV: production
          VITE_API_URL:
            value: ${shared:API_URL}
            comment: Production API endpoint
```

### 3. Generate Environment Files

Apply the configuration to your monorepo:

```bash
npx @jirayusueb/genv --apply
```

This automatically:

- Detects app directories (`packages/`, `apps/`, etc.)
- Generates `.env` files in the correct locations
- Uses the right filename based on environment name

## 📖 Usage

### CLI Commands

```bash
# Initialize a new config file
npx @jirayusueb/genv --init

# Apply config to monorepo (auto-detects directories)
npx @jirayusueb/genv --apply

# Generate all env files
npx @jirayusueb/genv --all

# Generate for specific app and environment
npx @jirayusueb/genv --app frontend --env production

# Use custom config file
npx @jirayusueb/genv --config my-config.yaml --apply
```

### Command Options

| Option            | Alias | Description                                                      |
| ----------------- | ----- | ---------------------------------------------------------------- |
| `--init`          | `-i`  | Initialize a new `genv.config.yaml` file                         |
| `--config <path>` | `-c`  | Path to config file (default: `genv.config.yaml`)                |
| `--app <name>`    | `-a`  | Generate env for specific app                                    |
| `--env <name>`    | `-e`  | Generate env for specific environment                            |
| `--all`           | `-A`  | Generate all env files for all apps and environments             |
| `--apply`         |       | Apply env files to monorepo structure (auto-detects directories) |
| `--help`          | `-h`  | Show help message                                                |

## 📝 Configuration

### Basic Structure

```yaml
# Shared variables (available to all apps)
shared:
  variables:
    DATABASE_HOST: localhost
    API_URL: https://api.example.com

# App-specific configurations
apps:
  frontend:
    environments:
      production:
        variables:
          NODE_ENV: production
          VITE_API_URL: ${shared:API_URL}
```

### Shared Variables

Define variables once and reuse them across all apps:

```yaml
shared:
  variables:
    DATABASE_HOST: localhost
    DATABASE_PORT: "5432"
    API_URL: https://api.example.com

apps:
  backend:
    environments:
      production:
        variables:
          DATABASE_URL: postgres://${shared:DATABASE_HOST}:${shared:DATABASE_PORT}/mydb
          # Resolves to: postgres://localhost:5432/mydb
```

### Variable Definition Formats

#### Format 1: Simple (String Value)

```yaml
variables:
  NODE_ENV: production
  PORT: "3000"
  DEBUG: "true"
```

#### Format 2: Extended (Object with Comment)

```yaml
variables:
  DATABASE_URL:
    value: postgres://localhost:5432/db
    comment: Database connection string
    type: string # Optional: for future type validation
```

**Generated `.env` file:**

```env
# Database connection string
DATABASE_URL=postgres://localhost:5432/db
```

You can mix both formats in the same environment configuration.

### Path Configuration

Control where `.env` files are generated:

**App-level path** (applies to all environments):

```yaml
apps:
  backend:
    path: apps/backend
    environments:
      production: { ... }
```

**Environment-level path** (overrides app-level):

```yaml
apps:
  backend:
    path: apps/backend
    environments:
      production:
        variables: { ... }
        path: apps/backend/config # Override for this environment
```

**Path priority** (highest to lowest):

1. Environment-level `path`
2. App-level `path`
3. Auto-detected directory (in `--apply` mode)
4. Root directory (fallback)

### Filename Convention

Filenames are automatically determined by environment name:

- `local` → `.env.local`
- `production` → `.env`
- Other environments → `.env.{environment}` (e.g., `.env.development`)

## 🏗️ Monorepo Support

### Auto-Detection

When using `--apply`, genv automatically detects app directories in common monorepo structures:

- `packages/{app}/`
- `apps/{app}/`
- `{app}/` (root level)
- `packages/@scope/{app}/` (for scoped packages)

### Example Structure

```
monorepo/
├── genv.config.yaml
├── packages/
│   ├── frontend/
│   │   └── .env.local          # Generated by genv
│   └── backend/
│       └── .env.production     # Generated by genv
└── apps/
    └── mobile/
        └── .env.development     # Generated by genv
```

### Configuration Example

```yaml
shared:
  variables:
    DATABASE_HOST: localhost

apps:
  frontend:
    # Auto-detected in packages/frontend/ or apps/frontend/
    environments:
      production: { ... }

  backend:
    path: apps/backend # Custom path
    environments:
      production: { ... }
```

## 📂 Examples

Check out the `examples/` directory for complete examples:

- **`with-monorepo/`** - Full monorepo setup with multiple apps
- **`with-root/`** - Single app at root level
- **`with-local-only/`** - Minimal setup with only local environment
- **`with-init-config/`** - Example of generated config from `--init`

## 🔧 Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/jirayusueb/genv.git
cd genv

# Install dependencies
bun install

# Build
bun run build

# Run in development mode
bun run dev

# Lint
bun run lint
```

### Project Structure

```
genv/
├── src/
│   ├── index.ts      # Entry point
│   ├── cli.ts        # CLI interface
│   ├── parser.ts     # YAML parsing and validation
│   ├── generator.ts  # Env file generation
│   └── types.ts      # TypeScript types and Zod schemas
├── examples/         # Example configurations
├── dist/             # Built output
└── genv.config.yaml  # Example config
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT © [jirayusueb](https://github.com/jirayusueb)

## 🔗 Links

- **npm**: https://www.npmjs.com/package/@jirayusueb/genv
- **GitHub**: https://github.com/jirayusueb/genv

---

**Made with ❤️ for monorepo developers**
