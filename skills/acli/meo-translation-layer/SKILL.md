---
name: meo-translation-layer
description: "Use when managing ACE environment operations via the MEO v3 gateway: environment variables, environment settings, available runtimes, operating systems, mod-proxy, StackMetrics data, or cron jobs using api:v3 translation commands."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, translation-layer, environment-variables, cron, mod-proxy, stackmetrics, runtimes"
    software_requirements: "acli>=2.x"
---

# MEO Translation Layer

> **Platform:** This skill applies to ACE environments accessed via the **MEO v3 gateway**.
> These are [development-stability] commands and may change without notice.
> For native MEO environment operations, see [MEO Environments](../meo-environments/SKILL.md).

## What is the Translation Layer?

The Translation Layer exposes classic **ACE (Cloud API v2)** environment operations — variables, crons, mod-proxy, StackMetrics, and runtimes — through the `acli api:v3:*` command namespace. Command names are auto-generated from the v3 gateway spec, so they are verbose (HTTP-verb + flattened path). Run `acli list api:v3 | grep translation` to see all currently available commands.

Use when:
- Managing environment variables for an ACE environment via the v3 gateway
- Inspecting or modifying environment settings and options
- Listing available PHP runtimes or operating systems for an environment
- Checking or toggling mod-proxy status
- Retrieving StackMetrics performance data
- Creating, updating, enabling, disabling, or deleting cron jobs

**Note:** All commands use `acli api:v3:*` and require an `<environmentId>` (ACE environment UUID). Confirm exact argument positions with `acli api:v3:<command> --help`.

---

## Environment Variables

```bash
# List all environment variables
acli api:v3:get-translation-environments-environment-id-variables <environmentId>

# Add a new environment variable
acli api:v3:post-translation-environments-environment-id-variables <environmentId> \
  --name=APP_KEY --value=aaaabbbbccccddddeee
```

> **Variable name rules:** must match `^[A-Za-z_][A-Za-z0-9_]*$`; names prefixed with `ACQUIA_` or `AH_` are reserved and will be rejected. Max length 255. Value max length 5000.

```bash
# Update an existing variable
acli api:v3:put-translation-environments-environment-id-variables-environment-variable-name \
  <environmentId> <variableName> --value=newvalue

# Get a single variable
acli api:v3:get-translation-environments-environment-id-variables-environment-variable-name \
  <environmentId> <variableName>
```

> **Destructive operation — explicit approval required.**
> Deleting an environment variable cannot be undone. Confirm with the user before executing.

```bash
acli api:v3:delete-translation-environments-environment-id-variables-environment-variable-name \
  <environmentId> <variableName>
```

### Example: Set an application secret

```bash
# Add the variable
acli api:v3:post-translation-environments-environment-id-variables \
  "$ENV_ID" --name=STRIPE_SECRET --value="$STRIPE_SECRET_VALUE"

# Verify it was created
acli api:v3:get-translation-environments-environment-id-variables "$ENV_ID"
```

---

## Environment Settings

```bash
# Get environment details (PHP version, region, configuration)
acli api:v3:get-translation-environments-environment-id <environmentId>

# Show available options for the environment
acli api:v3:options-translation-environments-environment-id <environmentId>

# Modify environment configuration
acli api:v3:put-translation-environments-environment-id <environmentId> [options]
```

Confirm supported fields with `--help` before running the `put` command.

---

## Runtimes & Operating Systems

```bash
# List available PHP runtimes for this environment
acli api:v3:get-translation-environments-environment-id-available-runtimes <environmentId>

# List available operating systems
acli api:v3:get-translation-environments-environment-id-operating-systems <environmentId>
```

Use these before changing the PHP version or runtime to verify the target version is available on the environment.

---

## Mod-Proxy

Mod-proxy enables proxying requests to an alternate origin for an environment.

```bash
# Check current mod-proxy status
acli api:v3:get-translation-environments-environment-id-mod-proxy <environmentId>

# Enable mod-proxy
acli api:v3:post-translation-environments-environment-id-mod-proxy-actions-enable <environmentId>

# Disable mod-proxy
acli api:v3:post-translation-environments-environment-id-mod-proxy-actions-disable <environmentId>
```

---

## StackMetrics

Returns time-series performance data for an environment (CPU, memory, requests, etc.).

```bash
acli api:v3:get-translation-environments-environment-id-metrics-stackmetrics-data <environmentId> \
  [--filter=<metric>] [--from=<datetime>]
```

| Option | Description |
|---|---|
| `--filter` | Metric type to filter on (e.g. `php-proc-count`, `mysql-slow-query-count`) |
| `--from` | Start of the time range (ISO 8601) |

```bash
# Example: recent PHP process count
acli api:v3:get-translation-environments-environment-id-metrics-stackmetrics-data \
  "$ENV_ID" --filter=php-proc-count
```

---

## Cron Management

```bash
# List all cron jobs for an environment
acli api:v3:get-translation-environments-environment-id-crons <environmentId>

# Get a specific cron job
acli api:v3:get-translation-environments-environment-id-crons-cron-id <environmentId> <cronId>
```

### Create a cron job

Three fields are required: `command`, `frequency` (cron expression), `label`.

```bash
acli api:v3:post-translation-environments-environment-id-crons <environmentId> \
  --command="drush cron" \
  --frequency="*/30 * * * *" \
  --label="Drupal cron every 30 min"
```

### Update a cron job

```bash
acli api:v3:put-translation-environments-environment-id-crons-cron-id \
  <environmentId> <cronId> --frequency="0 * * * *" --label="Drupal cron hourly"
```

### Enable / disable a cron job

```bash
# Enable
acli api:v3:post-translation-environments-environment-id-crons-cron-id-actions-enable \
  <environmentId> <cronId>

# Disable
acli api:v3:post-translation-environments-environment-id-crons-cron-id-actions-disable \
  <environmentId> <cronId>
```

### Delete a cron job

> **Destructive operation — explicit approval required.**
> Permanently removes the cron job. Confirm with the user before executing.

```bash
acli api:v3:delete-translation-environments-environment-id-crons-cron-id \
  <environmentId> <cronId>
```

### Example: Rotate a cron job

```bash
# Disable the old cron
acli api:v3:post-translation-environments-environment-id-crons-cron-id-actions-disable \
  "$ENV_ID" "$OLD_CRON_ID"

# Create the new schedule
acli api:v3:post-translation-environments-environment-id-crons "$ENV_ID" \
  --command="drush queue:run" --frequency="*/15 * * * *" --label="Queue worker"

# Confirm it appears in the list
acli api:v3:get-translation-environments-environment-id-crons "$ENV_ID"
```

---

## Discover More Commands

```bash
# List all translation-layer commands available in your ACLI version
acli list api:v3 | grep translation
acli api:v3:post-translation-environments-environment-id-crons --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model, authentication
- **[MEO Environments](../meo-environments/SKILL.md)** — Native MEO environment operations (protection mode, deployments, clear caches)
- **[MEO CDN & Security](../meo-cdn-security/SKILL.md)** — CDN domains, security rulesets, IP rules
