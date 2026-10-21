# Release and npm Trusted Publishing

This repository publishes the package named by `package.json` through the GitHub Actions workflow at `.github/workflows/publish.yml`.

The current package identity is the unscoped `pi-herdr-orchestration`. Do not run trust commands against a different scoped name unless `package.json`, documentation, and the release plan have been changed together.

## One-time prerequisites

1. Enable account-level two-factor authentication on npm.
2. Authenticate interactively from the maintainer machine:

   ```bash
   npm login --auth-type=web --registry=https://registry.npmjs.org/
   npm whoami --registry=https://registry.npmjs.org/
   ```

   `npm auth login` is not a login command; `npm auth` is an alias for package-owner operations.
3. Ensure the intended package name and version are committed on the release branch. The workflow rejects a tag that does not equal `v<package.json version>`.

## Package bootstrap

npm requires the package to exist before a trusted publisher can be configured. Bootstrap the first version once from a clean, reviewed release checkout using the interactive npm login above:

```bash
PACKAGE=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
npm pack --dry-run
npm publish --access public
npm view "$PACKAGE@$VERSION" version
```

After the first version is visible, configure GitHub Actions as the trusted publisher. This command requires npm 11.15+, account-level 2FA, and write access:

```bash
npm install --global 'npm@^11.15.0'
npm trust github "$(node -p "require('./package.json').name")" \
  --file publish.yml \
  --repo darkrei08/pi-herdr-orchestration \
  --allow-publish \
  --yes
npm trust list "$(node -p "require('./package.json').name")"
```

Do not create a bypass-2FA granular access token for this. GitHub's npm security changes restrict those tokens for account/package management and are deprecating their use for direct publishing; OIDC is the durable path.

## Normal releases

1. Update `package.json` and `CHANGELOG.md` on a clean reviewed branch.
2. Run the repository checks:

   ```bash
   npm test
   node scripts/check.mjs
   npm pack --dry-run
   git diff --check
   ```

3. Merge the reviewed change to `main`.
4. Create and push an annotated tag matching the package version:

   ```bash
   VERSION=$(node -p "require('./package.json').version")
   git tag -a "v$VERSION" -m "Release v$VERSION"
   git push origin "v$VERSION"
   ```

5. The workflow validates the tag/version pair, creates or updates the GitHub Release, and runs `npm publish --access public --provenance` using GitHub OIDC. No `NPM_TOKEN` secret or local publish is used for steady-state releases.
6. Verify the public package:

   ```bash
   npm view "$(node -p "require('./package.json').name")@$(node -p "require('./package.json').version")" version
   ```

## Reusable setup for another npm project

Replace the package and repository values, then repeat this sequence:

```bash
npm login --auth-type=web --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm install --global 'npm@^11.15.0'

PACKAGE=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
npm pack --dry-run
npm publish --access public
npm trust github "$PACKAGE" \
  --file publish.yml \
  --repo OWNER/REPOSITORY \
  --allow-publish \
  --yes
npm trust list "$PACKAGE"
```

The project's workflow must also contain:

```yaml
permissions:
  contents: read
  id-token: write

- uses: actions/setup-node@v4
  with:
    node-version: 22
    registry-url: https://registry.npmjs.org

- run: npm install --global 'npm@^11.15.0'
- run: npm publish --access public --provenance
```

Keep the one-time bootstrap separate from normal releases. Never commit `.npmrc`, tokens, OTPs, or credentials. Never paste them into issues, logs, or chat.
