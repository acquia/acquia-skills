---
name: environment-management
description: "Use when listing, creating, deleting, or mirroring Cloud environments, managing CDEs, deploying code to an environment, or checking environment status."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "ACE (Acquia Cloud Enterprise)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, environments, cde, deployment"
    software_requirements: "acli>=2.x"
---

# Environment Management with Acquia CLI

> **Platform:** This skill applies to **ACE (Acquia Cloud Enterprise)** subscriptions only.
> For MEO (Multi-site Enterprise Operations), see [MEO Environments](../meo-environments/SKILL.md).

Use when:
- Creating or deleting Continuous Delivery Environments (CDEs)
- Making one environment identical to another (mirroring)
- Copying cron tasks between environments
- Installing SSL certificates
- Listing or inspecting environments
- Deploying code to an environment

---

## List Environments

```bash
acli api:applications:environment-list
```

Shows all environments for an application (prod, staging, dev, and any CDEs).

---

## Get Environment Details

```bash
acli env:info
```

Shows PHP version, database, last deployment, URLs, and status for the selected environment.

---

## Create a Continuous Delivery Environment (CDE)

CDEs are on-demand environments — useful for testing feature branches before merging.

```bash
acli env:create "My Feature Branch" feature/my-branch
```

Arguments:
- `label` (required) — Human-readable name for the new environment
- `branch` (optional) — The git branch to deploy; prompts if omitted

```bash
# Interactive (prompts for branch)
acli env:create "QA Review"

# Non-interactive
acli env:create "Sprint 42 Demo" release/sprint-42
```

---

## Delete a CDE

```bash
acli env:delete
```

Prompts you to select the environment to delete. Only CDEs can be deleted; production and standard environments cannot.

---

## Deploy Code to an Environment

```bash
acli api:environments:code-switch <environmentId> <branch>
```

Example:

```bash
acli api:environments:code-switch 112927-9454a2b1-cce0-475e-ae5f-5374dbca9b0a master
```

Returns a notification UUID you can track with `acli app:task-wait <uuid>`.

---

## Mirror an Environment

Makes a destination environment identical to a source — copies code, database, files, and config.

```bash
acli env:mirror <source-environment> <destination-environment>
```

Use environment aliases in the format `app-name.env`:

```bash
acli env:mirror myapp.prod myapp.staging
```

**Skip specific components:**

```bash
acli env:mirror myapp.prod myapp.staging \
  --no-code \      # -c: skip code
  --no-databases \ # -d: skip databases
  --no-files \     # -f: skip files
  --no-config      # -p: skip configuration
```

> **Warning:** This overwrites the destination. All existing data in the destination environment is replaced.

---

## Copy Cron Tasks Between Environments

Copy all cron tasks from one environment to another:

```bash
acli env:cron-copy <source_env> <dest_env>
```

Example:

```bash
acli env:cron-copy myapp.prod myapp.staging
```

Useful after mirroring an environment to ensure scheduled tasks match.

---

## Install an SSL Certificate

```bash
acli env:certificate-create <certificate> <private-key>
```

Options:

```bash
acli env:certificate-create \
  /path/to/cert.pem \
  /path/to/private-key.pem \
  --label="My SSL Cert" \
  --ca-certificates=/path/to/ca-bundle.pem \
  --legacy              # Use legacy SSL (non-SNI)
```

To install from an existing CSR:

```bash
acli env:certificate-create cert.pem key.pem --csr-id=<csr-uuid>
```

---

## Typical Workflows

### Set up a CDE for a feature branch

```bash
# Create the environment
acli env:create "Feature: New Checkout" feature/new-checkout

# Mirror prod data to it
acli env:mirror myapp.prod myapp.<new-cde-id>
```

### Refresh staging from production

```bash
acli env:mirror myapp.prod myapp.staging
```

### Promote staging to prod

```bash
acli api:environments:code-switch <prod-env-id> main
```

---

## Best Practices

1. **Mirror before testing** — Always sync a CDE from prod or staging before QA.
2. **Clean up CDEs** — Delete CDEs when done; they consume resources.
3. **Test deploys in staging first** — Always deploy to staging before production.
4. **Copy crons after mirror** — Run `env:cron-copy` after mirroring to keep scheduled tasks in sync.

---

## Troubleshooting

### "Environment not found"

Check available environments:

```bash
acli api:applications:environment-list
```

### Mirror fails midway

Check logs and retry. Use `--no-databases` or `--no-files` to skip the component that failed:

```bash
acli env:mirror myapp.prod myapp.staging --no-files
```

---

## Related Topics

- **[Pull & Push](../pull-push/SKILL.md)** — Sync local and Cloud environments
- **[Application Management](../application-management/SKILL.md)** — Find application UUIDs
- **[Remote Access](../remote-access/SKILL.md)** — SSH and Drush on environments
