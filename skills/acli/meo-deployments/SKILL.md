---
name: meo-deployments
description: "Use when monitoring, stopping, or terminating MEO deployments. Deployments represent a code deploy operation running in a MEO environment."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, deployments, ci-cd"
    software_requirements: "acli>=2.x"
---

# MEO Deployment Management

> **Platform:** This skill applies to **MEO (Multi-site Enterprise Operations)** subscriptions only.

Use when:
- Checking the status of a running or completed deployment
- Stopping a deployment gracefully
- Listing all deployments for an environment
- Terminating a stuck deployment immediately

**Starting a deployment:** See [MEO Environments](../meo-environments/SKILL.md) — use `acli api:v3:environments:create-deployment`.

**Note:** All commands use `acli api:v3:*`. Run `acli list api:v3:deployments` to see all current deployment commands.

---

## Start a Deployment

Deployments are started from the environment, not the deployment resource:

```bash
acli api:v3:environments:create-deployment <environmentId> <run_hooks> <code_reference>
```

```bash
# Deploy main branch with hooks enabled
acli api:v3:environments:create-deployment <environmentId> true refs/heads/main

# Deploy a tag without hooks
acli api:v3:environments:create-deployment <environmentId> false refs/tags/1.5.0

# Deploy with hook argument
acli api:v3:environments:create-deployment <environmentId> true refs/heads/main \
  --hooks_argument="production"
```

Returns a `deploymentId` to track progress.

---

## Check Deployment Status

```bash
acli api:v3:deployments:find <deploymentId>
```

Returns status (`pending`, `running`, `completed`, `failed`, `stopped`, `terminated`), start time, and any error messages.

---

## List Deployments for an Environment

```bash
acli api:v3:environments:list-deployments <environmentId>
```

Supports pagination and filtering:

```bash
acli api:v3:environments:list-deployments <environmentId> --limit=10 --sort=-created
```

---

## Stop a Deployment

Sends a graceful stop request. The deployment finishes its current step and halts.

```bash
acli api:v3:deployments:stop <deploymentId>
```

Use when you want to safely interrupt a deployment that is taking too long or you've noticed an issue.

---

## Terminate a Deployment

> **Destructive operation — explicit approval required.**
> Immediately kills the deployment process regardless of current state. May leave sites in a partially deployed state. Confirm with the user before executing.

```bash
acli api:v3:deployments:terminate <deploymentId>
```

Use only when `stop` is insufficient (e.g. deployment is hung and unresponsive).

---

## Code Deploy Concurrency

Controls how many site instances can be deployed in parallel within an environment:

```bash
# Get current setting
acli api:v3:environments:find-code-deploy <environmentId>

# Update concurrency
acli api:v3:environments:update-code-deploy <environmentId> <concurrency>
```

---

## Typical Workflows

### Deploy and monitor

```bash
# Start deployment
acli api:v3:environments:create-deployment <environmentId> true refs/heads/main

# Poll for completion (deploymentId returned above)
acli api:v3:deployments:find <deploymentId>
```

### CI/CD pipeline deploy step

```bash
#!/bin/bash
set -e

DEPLOYMENT=$(acli api:v3:environments:create-deployment \
  "$ENV_ID" true "refs/heads/$BRANCH" --no-interaction)

DEPLOYMENT_ID=$(echo "$DEPLOYMENT" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

# Poll until complete
while true; do
  STATUS=$(acli api:v3:deployments:find "$DEPLOYMENT_ID" | \
    python3 -c "import json,sys; print(json.load(sys.stdin)['status'])")
  echo "Deployment status: $STATUS"
  case "$STATUS" in
    completed) echo "Deployment succeeded"; exit 0 ;;
    failed|stopped|terminated) echo "Deployment failed"; exit 1 ;;
  esac
  sleep 15
done
```

---

## Discover More Commands

```bash
acli list api:v3:deployments
acli list api:v3:environments
acli api:v3:environments:create-deployment --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model
- **[MEO Environments](../meo-environments/SKILL.md)** — Start deployments, manage environment settings
- **[MEO Codebases](../meo-codebases/SKILL.md)** — Find the git reference to deploy
- **[MEO Site Instances](../meo-site-instances/SKILL.md)** — Verify site instance state after deployment
