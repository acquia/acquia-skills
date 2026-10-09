---
name: scripting
description: "Use when running acli commands non-interactively in scripts, CI/CD pipelines, or automation where interactive prompts must be suppressed."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: automation
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, scripting, ci-cd, automation"
    software_requirements: "acli>=2.x"
---

# Scripting & Automation with Acquia CLI

Use when:
- Automating acli commands in shell scripts
- Integrating acli into CI/CD pipelines
- Running acli non-interactively

Use acli in scripts, CI/CD pipelines, and automation workflows to manage Acquia Cloud resources programmatically.

---

## Non-Interactive Commands

All acli commands can run non-interactively by providing options. This is essential for scripts and CI/CD.

### Basic pattern

```bash
# Interactive - prompts for missing information
acli ide:create

# Non-interactive - provides all info upfront
acli ide:create \
  --application=abc123 \
  --label="Automated IDE"
```

### Common options

```bash
# No prompts - fails if info is missing
acli <command> --no-interaction

# Don't wait for async operations
acli <command> --no-wait

# Skip confirmations
acli <command> --yes
```

---

## Simple Automation Examples

### Example 1: Deploy on schedule

```bash
#!/bin/bash
# deploy.sh - Deploy to staging nightly

BRANCH="develop"
ENVIRONMENT="staging"
ENV_ID="<environment-id>"

acli api:environments:code-switch $ENV_ID $BRANCH

# Verify Drupal status
acli remote:drush status
```

> **MEO (V3) subscriptions:** replace the `api:environments:code-switch` line with
> `acli api:v3:environments:create-deployment $ENV_ID true $BRANCH` (see
> [MEO Deployments](../meo-deployments/SKILL.md)). Likewise, `acli remote:drush cr`
> has an API-driven equivalent, `acli api:v3:environments:clear-caches <environmentId> <domains>`
> (see [MEO Environments](../meo-environments/SKILL.md)).

Run via cron:

```bash
# crontab -e
# Deploy every night at 2am
0 2 * * * /path/to/deploy.sh >> /tmp/deploy.log 2>&1
```

### Example 2: Cache clearing workflow

```bash
#!/bin/bash
# cache-clear.sh - Clear caches across environments

set -e  # Exit on any error

acli remote:drush cr
echo "Caches cleared!"
```

---

## CI/CD Integration

### GitHub Actions

Deploy on push to main:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Acquia

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install acli
        run: |
          curl -fsSL https://github.com/acquia/cli/releases/latest/download/acli \
            -o /usr/local/bin/acli
          chmod +x /usr/local/bin/acli

      - name: Deploy to production
        env:
          ACLI_KEY: ${{ secrets.ACQUIA_KEY }}
          ACLI_SECRET: ${{ secrets.ACQUIA_SECRET }}
        run: |
          acli api:environments:code-switch ${{ vars.ACQUIA_PROD_ENV_ID }} main
```

Store the credentials as repository secrets named `ACQUIA_KEY`/`ACQUIA_SECRET`; the `env:`
block above maps them into the job as `ACLI_KEY`/`ACLI_SECRET`, which is what ACLI itself
reads. They take first priority over any stored credentials, so there's no credentials file
to write — just map them for the step that needs them.

### GitLab CI/CD

```yaml
# .gitlab-ci.yml
deploy_production:
  stage: deploy
  image: ubuntu:latest
  variables:
    ACLI_KEY: $ACQUIA_KEY
    ACLI_SECRET: $ACQUIA_SECRET
  before_script:
    - curl -fsSL https://github.com/acquia/cli/releases/latest/download/acli \
        -o /usr/local/bin/acli
    - chmod +x /usr/local/bin/acli
  script:
    - acli api:environments:code-switch $ACQUIA_PROD_ENV_ID $CI_COMMIT_BRANCH
  only:
    - main
```

Set `ACQUIA_KEY` and `ACQUIA_SECRET` as masked CI/CD variables in the project's Settings →
CI/CD → Variables. GitLab injects CI/CD variables into the job environment under the same
name they're stored as, so the `variables:` block above re-maps them to `ACLI_KEY`/`ACLI_SECRET`
for the job — that's the name ACLI itself reads.

---

## Error Handling

### Check exit codes

```bash
#!/bin/bash

acli ide:create --application=abc123

if [ $? -eq 0 ]; then
    echo "IDE created successfully"
else
    echo "IDE creation failed"
    exit 1
fi
```

### Handle errors gracefully

```bash
#!/bin/bash
set -e  # Exit on first error

trap 'echo "Error occurred on line $LINENO"' ERR

acli api:environments:code-switch $ENV_ID main
echo "Deploy successful!"
```

### Retry logic

```bash
#!/bin/bash

retry_count=0
max_retries=3

while [ $retry_count -lt $max_retries ]; do
    if acli remote:drush updatedb; then
        echo "Database updates completed"
        exit 0
    fi
    retry_count=$((retry_count + 1))
    if [ $retry_count -lt $max_retries ]; then
        echo "Attempt $retry_count failed. Retrying..."
        sleep 10
    fi
done

echo "Failed after $max_retries attempts"
exit 1
```

---

## Logging & Monitoring

### Log output

```bash
#!/bin/bash

LOGFILE="/var/log/acli-deploy.log"

{
    echo "=== Deploy started at $(date) ==="
    acli api:environments:code-switch $ENV_ID main
    echo "=== Deploy finished at $(date) ==="
} >> $LOGFILE 2>&1
```

### Send notifications

```bash
#!/bin/bash

SLACK_WEBHOOK="$SLACK_WEBHOOK_URL"

send_slack() {
    curl -X POST $SLACK_WEBHOOK \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"Acquia deployment: $1\",
            \"channel\": \"#deployments\"
        }"
}

if acli api:environments:code-switch $ENV_ID main; then
    send_slack "✓ Production deployment successful"
else
    send_slack "✗ Production deployment failed"
    exit 1
fi
```

---

## Advanced: Authenticating Without a Human Present

Three options for unattended automation, depending on whether a human is in the loop at all:

**API key + secret via environment variables** — for a true service account with nobody ever
approving a login (a long-running CI bot, a scheduled job). Generate a key in Acquia Cloud UI
under Settings → API Tokens, then pass it via environment variables:

```bash
export ACLI_KEY="your-key-here"
export ACLI_SECRET="your-secret-here"
acli api:applications:list
```

These take first priority over any stored credentials, so no prior `acli auth:login` is
needed on the machine running this — every command reads them fresh, and nothing is written
to disk.

**API key + secret via `auth:login --key`/`--secret`** — the same credentials, used instead
to persist a stored session once rather than exporting the pair for every command:

```bash
acli auth:login --key="$ACLI_KEY" --secret="$ACLI_SECRET" --no-interaction
```

This writes the credentials to `~/.acquia/cloud_api.conf`, so subsequent commands in the same
job pick them up without re-passing anything. **Only pass the values through a variable like
this, never as literal text** — a literal `--key=abc123` on the command line appears in shell
history and in process listings (`ps aux`) on the same machine. If the runner is shared or
multi-tenant, prefer the environment-variable-only option above, which never puts the secret
on the command line at all.

**Device code with `--no-interaction`** — for agent-driven automation where a human still
exists to approve the sign-in (just not interactively, in this exact process). Running
`acli auth:login --no-interaction` with no stored credentials starts the device code flow and
prints the verification URL and code to stdout without prompting for anything; an existing
device session re-authenticates the same way. A human still has to approve in a browser, but
the command itself never blocks on terminal input.

### Secure credential management

```bash
# Option 1: AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id acquia-cli-key

# Option 2: HashiCorp Vault
vault kv get secret/acquia/cli-key

# Option 3: GitHub Secrets (for Actions)
# Set ACQUIA_KEY and ACQUIA_SECRET as repository secrets
```

---

## Best Practices

1. **Use `--no-interaction`** — Always pass this in scripts to prevent prompts from blocking the process.
2. **Use `set -e`** — Exit immediately on any error so failures don't silently continue.
3. **Store credentials securely** — Use environment variables or secrets managers, never hardcode.
4. **Use `app:task-wait`** — After async operations, wait for completion before the next step.

---

## Troubleshooting

### Authentication fails in CI

For a service account with no human ever approving a login, export the key and secret —
these take priority over any stored credentials automatically, with no `auth:login` step and
no `--no-interaction` flag needed:

```bash
export ACLI_KEY=your-api-key
export ACLI_SECRET=your-api-secret
acli api:applications:list
```

If a human does approve sign-in (agent-driven automation, not a pure service account), use
`acli auth:login --no-interaction` instead — there's no separate environment variable for
suppressing prompts, only the `--no-interaction`/`-n` flag on the command itself.

### Command hangs waiting for input

Always pass `--no-interaction` in scripts:

```bash
acli ide:create --application=abc123 --label="CI IDE" --no-interaction
```

### Exit code not propagated correctly

Use `set -e` at the top of your script:

```bash
#!/bin/bash
set -e
acli auth:login --no-interaction
acli api:environments:code-switch $ENV_ID main
```
