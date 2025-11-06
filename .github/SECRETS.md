# GitHub Secrets Setup

This repository uses GitHub Actions for CI/CD. To enable automatic publishing to npm, you need to set up the following secret:

## Required Secrets

### NPM_TOKEN

An npm access token with publish permissions.

**How to create:**

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token" → "Automation" (or "Publish")
3. Copy the token
4. Go to your GitHub repository → Settings → Secrets and variables → Actions
5. Click "New repository secret"
6. Name: `NPM_TOKEN`
7. Value: Paste your npm token
8. Click "Add secret"

**Note:** The token needs publish permissions for the `@jirayusueb` scope.

## Workflows

- **CI** (`.github/workflows/ci.yml`): Runs on every push/PR - tests, lints, and builds
- **Test** (`.github/workflows/test.yml`): Tests on multiple Node.js versions
- **Release** (`.github/workflows/release.yml`): Publishes to npm when a version tag is pushed

## Publishing a New Version

1. Update version in `package.json`
2. Commit and push changes
3. Create and push a version tag:
   ```bash
   git tag v0.1.2
   git push origin v0.1.2
   ```
4. The release workflow will automatically publish to npm
