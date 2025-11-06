# Init Config Example

This example demonstrates how to use `genv --init` to bootstrap a new configuration file.

## Quick Start

1. **Initialize a new config file:**
   ```bash
   cd examples/with-init-config
   npx genv --init --config genv.config.yaml
   ```

2. **This creates a template `genv.config.yaml` file** with:
   - Example shared variables
   - Example apps (frontend, backend)
   - Example environments (local, development, production)
   - Comments explaining each section

3. **Customize the config** to match your project needs

4. **Generate environment files:**
   ```bash
   npx genv --apply --config genv.config.yaml
   ```

## What `genv --init` Creates

The `--init` command generates a comprehensive template with:

### Shared Variables
- Common infrastructure variables (database, API, Redis)
- Examples of how to use `${shared:VARIABLE_NAME}` interpolation

### Example Apps
- **Frontend**: Shows Vite/React-style environment variables
- **Backend**: Shows database and API configuration

### Environments
- **local**: For local development (generates `.env.local`)
- **development**: For dev/staging (generates `.env.development`)
- **production**: For production (generates `.env`)

## Customization

After initialization, you can:
1. Add your own apps
2. Add/remove environments
3. Define your shared variables
4. Configure custom paths for each app
5. Add comments to document variables

## Example Workflow

```bash
# 1. Initialize config
npx genv --init

# 2. Edit genv.config.yaml to match your project
# (add your apps, variables, etc.)

# 3. Generate environment files
npx genv --apply

# 4. Your .env files are ready!
```

## Tips

- Use `--config` flag to specify a custom config filename
- The init command will not overwrite existing files
- Start with the template and modify it to suit your needs

