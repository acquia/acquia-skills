---
name: pipeline-operations
description: "Use when user asks about pipeline status, CI build status, triggering a build, streaming pipeline logs, terminating a job, or checking if a pipeline passed or failed. Use pipelines-cli, NOT acli."
license: Proprietary
compatibility: pipelines-cli>=1.x
metadata:
    category: ci-cd
    author: Acquia
    version: "1.0.0"
    tags: "pipelines-cli, acquia-cloud, pipelines, ci-cd, jobs"
    software_requirements: "pipelines-cli>=1.x"
---

# Pipeline Operations with Acquia Pipelines CLI

Use when:
- Triggering a pipeline build
- Checking pipeline job status or streaming logs
- Terminating a running job
- Encrypting pipeline variables or connecting GitHub

Use the Pipelines CLI to trigger, monitor, and manage CI/CD pipeline jobs on Acquia Cloud.

> See **[Getting Started](../getting-started/SKILL.md)** for installation, authentication, and finding your application ID.

---

## Starting a Pipeline Job

> **Important:** `pipelines start` fires immediately — there is no confirmation prompt. Verify your application ID and target branch before running.

### Verify before starting

```bash
# Confirm the application ID
pipelines list-applications

# Check whether a job is already running on the branch
pipelines status --application-id=1g2i3b4b5o6u7s --job-id=latest
```

Proceed with `start` only after confirming the correct application and branch.

### Start for the current branch

Run from inside your git repository:

```bash
pipelines start --application-id=1g2i3b4b5o6u7s
```

The CLI detects the current branch automatically.

### Start for a specific branch

```bash
pipelines start \
  --application-id=1g2i3b4b5o6u7s \
  --vcs-path=feature/my-branch
```

### Start and write artifact to a deploy branch

```bash
pipelines start \
  --application-id=1g2i3b4b5o6u7s \
  --vcs-path=feature/my-branch \
  --deploy-vcs-path=deploy/my-branch
```

The build artifact is pushed to `deploy/my-branch` on success.

### Start with environment variables

```bash
pipelines start \
  --application-id=1g2i3b4b5o6u7s \
  --vcs-path=main \
  -D MY_VAR=foo \
  -D ANOTHER_VAR=bar
```

### Start and stream logs immediately

```bash
pipelines start --application-id=1g2i3b4b5o6u7s --tail
```

### Start with log streaming delay

Useful when the build takes a moment to produce output:

```bash
pipelines start --application-id=1g2i3b4b5o6u7s --tail --delay=5
```

### Start with retry options

Control how many times the log streaming retries on failure:

```bash
pipelines start \
  --application-id=1g2i3b4b5o6u7s \
  --retries=3 \
  --delay=5
```

### Start from an external (non-Acquia) repository

Use `--source-vcs-uri` to pull source code from a GitHub or other external repo, with `--source-key-path` pointing to the SSH private key for access:

```bash
pipelines start \
  --application-id=1g2i3b4b5o6u7s \
  --source-vcs-uri=git@github.com:myorg/myrepo.git \
  --source-key-path=~/.ssh/id_rsa \
  --vcs-path=main
```

> **Note:** Pass the **private** key path, not the `.pub` file.

### Start with container kept alive for debugging

Keeps the build container running after the job completes so you can SSH in to debug:

```bash
pipelines start --application-id=1g2i3b4b5o6u7s --keep-process-alive
```

You will be prompted to confirm before the build starts.

### Start using a codebase ID instead of application ID

```bash
pipelines start \
  --codebase-id=abcd1234-5678-90ab-cdef-000000000000 \
  --vcs-path=main
```

Output on success:
```
Successfully started a build:
VCS path: main
Target deployment branch: pipelines-build-main
Job ID: job-abc12345
```

---

## Checking Job Status

### Check status of the latest job

```bash
pipelines status --application-id=1g2i3b4b5o6u7s --job-id=latest
```

### Check status for a specific job

```bash
pipelines status \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=job-abc12345
```

### Check status of latest job on a specific branch

```bash
pipelines status \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=latest:main
```

Output:
```
Job ID: job-abc12345
Status: succeeded
Summary:
Site: my-site
VCS path: main
Submitted: 2024-02-20 10:15:00 (UTC)
Started: 2024-02-20 10:15:05 (UTC)
Finished: 2024-02-20 10:18:34 (UTC)
```

Possible status values: `succeeded`, `aborted`, `system failure`, `build error`, `queued`, `running`, `paused`.

### Machine-readable JSON output

```bash
pipelines status \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=latest \
  --format=json
```

---

## Viewing Logs

### View logs for the latest job

```bash
pipelines logs \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=latest
```

### View logs for a specific job

```bash
pipelines logs \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=job-abc12345
```

### Stream (tail) logs live

```bash
pipelines logs \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=latest \
  --tail
```

### Save logs to file

```bash
pipelines logs \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=latest > pipeline.log 2>&1
```

---

## Listing Jobs

```bash
pipelines list-jobs 1g2i3b4b5o6u7s
```

Output lists recent jobs with their IDs, statuses, and branches.

---

## Terminating a Job

Cancel a running job:

```bash
pipelines terminate-job \
  --application-id=1g2i3b4b5o6u7s \
  --job-id=job-abc12345
```

---

## Encrypting Pipeline Variables

Encrypt sensitive values for use in `acquia-pipelines.yml`:

```bash
pipelines encrypt
```

You will be prompted for the confidential data. Paste the encrypted output into your `acquia-pipelines.yml` file.

---

## Container Configuration

Container configuration for Acquia Pipelines is defined in `acquia-pipelines.yml`
at the root of your repository. The `pipelines start` command picks this file up
automatically — there are no CLI flags for container settings.

---

### Minimal configuration structure

```yaml
version: 1.1.0

events:
  build:
    steps:
      - build:
          type: script
          script:
            - composer install
```

---

### Configure the PHP version

Use the `services` key to pin the PHP version for the build container:

```yaml
version: 1.1.0

services:
  - php:
      version: 8.2

events:
  build:
    steps:
      - composer:
          type: script
          script:
            - composer install --no-progress
```

Supported versions depend on your Acquia Cloud subscription. Common values: `8.1`, `8.2`, `8.3`.

---

### Add a MySQL service

Include `mysql` under `services` when your build needs a database:

```yaml
version: 1.0.0

services:
  - mysql

events:
  build:
    steps:
      - build:
          type: script
          script:
            - mysql -u root -proot -e "CREATE DATABASE mydb"
            - composer install --no-interaction
```

MySQL is available at `127.0.0.1:3306` with credentials `root:root`.

---

### Set environment variables

Declare plain-text variables in the `variables.global` section:

```yaml
version: 1.1.0

variables:
  global:
    APP_ENV: ci
    PHP_MEMORY_LIMIT: 512M

events:
  build:
    steps:
      - build:
          type: script
          script:
            - composer install
```

For sensitive values, encrypt first with the CLI then paste the result:

```bash
pipelines encrypt
# Paste your secret value when prompted
# Copy the output — a long encoded string
```

Then reference it in the YAML:

```yaml
variables:
  global:
    MY_SECRET:
      secure: <paste encrypted output here>
```

The decrypted value is available as `$MY_SECRET` inside build steps.

---

### Add SSH keys for private dependencies

If your build pulls from private repositories, add an encrypted SSH key:

```bash
# Encrypt your private key
cat ~/.ssh/id_rsa | pipelines encrypt
```

Reference it in the YAML under `ssh-keys`:

```yaml
version: 1.1.0

ssh-keys:
  my-deploy-key:
    secure: <encrypted private key>

events:
  build:
    steps:
      - build:
          type: script
          script:
            - composer install
```

The key is loaded automatically into the build container before steps run.

---

### Multi-service example (PHP + MySQL + Node)

```yaml
version: 1.1.0

services:
  - php:
      version: 8.2
  - mysql

variables:
  global:
    APP_ENV: ci
    DB_URL: mysql://root:root@127.0.0.1:3306/mydb
    NPM_TOKEN:
      secure: <encrypted token>

events:
  build:
    steps:
      - setup-db:
          type: script
          script:
            - mysql -u root -proot -e "CREATE DATABASE mydb"
      - backend:
          type: script
          script:
            - composer install --no-interaction
      - frontend:
          type: script
          script:
            - nvm install node
            - npm install
            - npm run build
```

---

### Validate your configuration before triggering

There is no `pipelines validate` command. Check for common issues manually:

```bash
# Confirm the file is valid YAML
python3 -c "import yaml,sys; yaml.safe_load(open('acquia-pipelines.yml'))" \
  && echo "Valid YAML" || echo "Parse error"

# Confirm it is committed and pushed — pipelines reads from the remote branch
git status acquia-pipelines.yml
git push
```

Then trigger and stream logs to catch runtime errors immediately:

```bash
pipelines start --application-id=<app-id> --tail
```

---

## GitHub Integration

> **Note:** The Pipelines CLI supports GitHub only. Bitbucket is not supported by the command-line client.

### Connect a GitHub repository

```bash
pipelines github:connect
```

### Disconnect a GitHub repository

```bash
pipelines github:disconnect
```

---

## CI/CD Integration

### GitHub Actions — trigger and wait

```yaml
# .github/workflows/pipeline.yml
name: Trigger Acquia Pipeline

on:
  push:
    branches: [main]

jobs:
  pipeline:
    runs-on: ubuntu-latest
    steps:
      - name: Install Pipelines CLI
        run: |
          wget https://cloud.acquia.com/pipelines-client/download -O pipelines
          chmod +x pipelines
          sudo mv pipelines /usr/local/bin/pipelines

      - name: Configure credentials
        run: |
          echo "${{ secrets.PIPELINES_CONFIG }}" > ~/.pipelines-config

      - name: Start pipeline
        run: |
          pipelines start \
            --application-id=${{ vars.ACQUIA_APP_ID }} \
            --vcs-path=main \
            --tail
```

### Poll for status in a script

```bash
#!/bin/bash
set -e

APP_ID="1g2i3b4b5o6u7s"
BRANCH="main"

echo "Starting pipeline..."
pipelines start --application-id=$APP_ID --vcs-path=$BRANCH

echo "Waiting for job to complete..."
while true; do
  STATUS=$(pipelines status \
    --application-id=$APP_ID \
    --job-id=latest:$BRANCH \
    --format=json | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")

  echo "Status: $STATUS"

  case "$STATUS" in
    succeeded)
      echo "Pipeline succeeded!"
      exit 0
      ;;
    "build error"|aborted|"system failure")
      echo "Pipeline failed: $STATUS"
      pipelines logs --application-id=$APP_ID --job-id=latest:$BRANCH
      exit 1
      ;;
  esac

  sleep 15
done
```

---

## Best Practices

1. **Verify before starting** — Always run `pipelines list-applications` to confirm the app ID before `pipelines start`.
2. **Use `--tail` during development** — Stream logs immediately so failures surface without a separate `logs` call.
3. **Store credentials securely** — Use `pipelines configure` to store credentials; never hardcode them in env vars or scripts.
4. **Avoid duplicate runs** — Check `pipelines status --job-id=latest` before re-triggering to avoid redundant builds.
5. **Encrypt sensitive values** — Use `pipelines encrypt` for any secrets referenced in `acquia-pipelines.yml`.

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `Unable to authenticate` | Credentials not configured or expired | Run `pipelines configure` again |
| `No pipeline configuration found` | Missing `acquia-pipelines.yml` in repo | Add the build definition file and push |
| `The vcs branch does not exist in remote` | Branch not pushed to Acquia remote | Push the branch first: `git push acquia feature/my-branch` |
| `The build file has local uncommitted changes` | `acquia-pipelines.yml` has unsaved changes | Commit and push the build file |
| `Badly formed job` | Job ID is invalid or expired | Use `pipelines list-jobs` to find a valid job ID |
