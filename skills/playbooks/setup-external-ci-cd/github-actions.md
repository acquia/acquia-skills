# GitHub Actions — CI files

Provider-specific templates for [setup-external-ci-cd](./SKILL.md). Complete the one-time setup (secrets,
approval-gate environments, `post-code-deploy` hook) in `SKILL.md` first, then write these files into
`.github/workflows/`.

**Before writing:** substitute `<PHP_VERSION>` with the app's actual PHP version
(see [Determine the PHP version](./SKILL.md#determine-the-php-version)) — do not hardcode it.

Approval gates come from GitHub **Environments** named `acquia-dev` / `acquia-test` / `acquia-prod`
(`deploy-test`/`deploy-prod` pause until a required reviewer approves).

## `pipeline.yml` — orchestrator

Chains reusable `ci` / `build-push` / `deploy` workflows.

```yaml
name: Pipeline
on:
  push:
    branches: [main, master]
    paths-ignore: ['**.md']
  pull_request:
    branches: [main, master]
jobs:
  ci:
    uses: ./.github/workflows/ci.yml
  build-push:
    needs: ci
    if: github.event_name == 'push'
    uses: ./.github/workflows/build-push.yml
    with:
      deploy-branch: pipelines-build-${{ github.ref_name }}
    secrets: inherit
  deploy-dev:
    needs: build-push
    uses: ./.github/workflows/deploy.yml
    with:
      environment: dev
      reference: tags/${{ needs.build-push.outputs.release-tag }}
    secrets: inherit
  deploy-test:
    needs: [build-push, deploy-dev]
    uses: ./.github/workflows/deploy.yml
    with:
      environment: test
      reference: tags/${{ needs.build-push.outputs.release-tag }}
    secrets: inherit
  deploy-prod:
    needs: [build-push, deploy-test]
    uses: ./.github/workflows/deploy.yml
    with:
      environment: prod
      reference: tags/${{ needs.build-push.outputs.release-tag }}
    secrets: inherit
```

## `ci.yml` — code quality (push + PR)

```yaml
name: CI
on:
  workflow_call:
  push:
    branches-ignore: ['pipelines-build-**']
  pull_request:
    branches: [main, master]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '<PHP_VERSION>'
          tools: composer:v2
      - run: composer validate --strict --no-interaction
      - run: composer install --prefer-dist --no-interaction --no-progress
      - run: composer audit --no-interaction
      - run: vendor/bin/phpcs --standard=phpcs.xml.dist docroot/modules/custom docroot/themes/custom
      - run: vendor/bin/phpstan analyse --configuration=phpstan.neon.dist --no-progress
```

## `build-push.yml` — build & push artifact (reusable)

```yaml
name: Build & push
on:
  workflow_call:
    inputs:
      deploy-branch:
        required: true
        type: string
    outputs:
      release-tag:
        value: ${{ jobs.build-push.outputs.release-tag }}
jobs:
  build-push:
    runs-on: ubuntu-latest
    outputs:
      release-tag: ${{ steps.push.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '<PHP_VERSION>'
          tools: composer:v2
      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.ACQUIA_SSH_PRIVATE_KEY }}
          ssh-passphrase: ${{ secrets.ACQUIA_SSH_PASSPHRASE }}
      - name: Install acli & trust host
        run: |
          curl -sSL https://github.com/acquia/cli/releases/latest/download/acli.phar -o /usr/local/bin/acli
          chmod +x /usr/local/bin/acli
          mkdir -p ~/.ssh
          ssh-keyscan -H "$(echo "${{ secrets.ACQUIA_GIT_URL }}" | sed 's/.*@//; s/:.*//')" >> ~/.ssh/known_hosts
      - name: Authenticate
        run: acli auth:login --key="${{ secrets.ACQUIA_CLI_KEY }}" --secret="${{ secrets.ACQUIA_CLI_SECRET }}" --no-interaction
      - name: Build & push
        id: push
        run: |
          TAG="build-${{ github.run_id }}"
          acli push:artifact "${{ secrets.ACQUIA_DEV_ENV_ID }}" \
            --destination-git-branch="${{ inputs.deploy-branch }}" \
            --destination-git-tag="$TAG" --no-interaction
          echo "tag=$TAG" >> "$GITHUB_OUTPUT"
```

## `deploy.yml` — deploy one environment (reusable)

```yaml
name: Deploy
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      reference:
        required: true
        type: string
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: acquia-${{ inputs.environment }}   # approval gate for test/prod
    steps:
      - name: Install acli & authenticate
        run: |
          curl -sSL https://github.com/acquia/cli/releases/latest/download/acli.phar -o /usr/local/bin/acli
          chmod +x /usr/local/bin/acli
          acli auth:login --key="${{ secrets.ACQUIA_CLI_KEY }}" --secret="${{ secrets.ACQUIA_CLI_SECRET }}" --no-interaction
      - name: Resolve environment ID
        id: env
        run: |
          case "${{ inputs.environment }}" in
            dev)  echo "id=${{ secrets.ACQUIA_DEV_ENV_ID }}"  >> "$GITHUB_OUTPUT" ;;
            test) echo "id=${{ secrets.ACQUIA_TEST_ENV_ID }}" >> "$GITHUB_OUTPUT" ;;
            prod) echo "id=${{ secrets.ACQUIA_PROD_ENV_ID }}" >> "$GITHUB_OUTPUT" ;;
          esac
      # Reference is POSITIONAL, never --branch=. --task-wait blocks until the deploy finishes.
      - name: Deploy
        run: acli api:environments:code-switch "${{ steps.env.outputs.id }}" "${{ inputs.reference }}" --task-wait --no-interaction
```

## `test-connection.yml` — one-off pre-flight

Run manually before the first real deploy to verify SSH + API access.

```yaml
name: Test connection
on:
  workflow_dispatch:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.ACQUIA_SSH_PRIVATE_KEY }}
          ssh-passphrase: ${{ secrets.ACQUIA_SSH_PASSPHRASE }}
      - name: Check git + API
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H "$(echo "${{ secrets.ACQUIA_GIT_URL }}" | sed 's/.*@//; s/:.*//')" >> ~/.ssh/known_hosts
          git ls-remote "${{ secrets.ACQUIA_GIT_URL }}" HEAD
          curl -sSL https://github.com/acquia/cli/releases/latest/download/acli.phar -o /usr/local/bin/acli && chmod +x /usr/local/bin/acli
          acli auth:login --key="${{ secrets.ACQUIA_CLI_KEY }}" --secret="${{ secrets.ACQUIA_CLI_SECRET }}" --no-interaction
          acli api:accounts:find --no-interaction
```

## Set secrets from the CLI

```bash
gh secret set ACQUIA_SSH_PRIVATE_KEY < ~/.ssh/acquia_byot_cicd
gh secret set ACQUIA_CLI_KEY --body "<key>"
gh secret set ACQUIA_CLI_SECRET --body "<secret>"
gh secret set ACQUIA_GIT_URL --body "<git-url>"
gh secret set ACQUIA_APP_UUID --body "<uuid>"
gh secret set ACQUIA_DEV_ENV_ID  --body "<dev-env-id>"
gh secret set ACQUIA_TEST_ENV_ID --body "<test-env-id>"
gh secret set ACQUIA_PROD_ENV_ID --body "<prod-env-id>"
# Approval-gate environments
gh api -X PUT repos/{owner}/{repo}/environments/acquia-dev
gh api -X PUT repos/{owner}/{repo}/environments/acquia-test
gh api -X PUT repos/{owner}/{repo}/environments/acquia-prod   # add required reviewers in Settings → Environments
```
