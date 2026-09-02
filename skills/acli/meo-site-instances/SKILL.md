---
name: meo-site-instances
description: "Use when managing MEO site instances: inspecting a site in a specific environment, managing domains, databases, backups, protection mode, or scheduling a site instance for deletion."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, site-instances, database, backups"
    software_requirements: "acli>=2.x"
---

# MEO Site Instance Management

> **Platform:** This skill applies to **MEO (Multi-site Enterprise Operations)** subscriptions only.

A **site instance** is a specific [Site](../meo-sites/SKILL.md) running inside a specific [Environment](../meo-environments/SKILL.md). Each site instance has its own domain(s), database, and protection mode state.

Use when:
- Inspecting a site's status within a specific environment
- Managing domains for a site instance
- Accessing database details or managing backups
- Enabling, disabling, or inheriting protection mode
- Scheduling a site instance for deletion or recovering it
- Wiping a site instance (database + files reset)

**Addressing site instances:** Commands require both `<siteId>` and `<environmentId>` as separate arguments.

**Note:** All commands use `acli api:v3:*`. Run `acli list api:v3:site-instances` to see all current commands.

---

## Get Site Instance Details

```bash
acli api:v3:site-instances:find <siteId> <environmentId>
```

Returns status, domains, protection mode, database connection, and deployment info.

---

## List Site Instances in an Environment

```bash
acli api:v3:environments:list-site-instances <environmentId>
```

---

## Protection Mode

Protection mode prevents destructive operations (wipe, deletion) on the site instance.

```bash
# Enable protection on this site instance
acli api:v3:site-instances:enable-protection-mode <siteId> <environmentId>

# Disable protection
acli api:v3:site-instances:disable-protection-mode <siteId> <environmentId>

# Inherit protection mode from the parent environment
acli api:v3:site-instances:inherit-protection-mode <siteId> <environmentId>
```

---

## Domains

```bash
# List domains assigned to this site instance
acli api:v3:site-instances:list-domains <siteId> <environmentId>

# Get details for a specific domain
acli api:v3:site-instances:find-domain <siteId> <environmentId> <domainName>

# Check domain provisioning status
acli api:v3:site-instances:find-domain-status <siteId> <environmentId> <domainName>
```

---

## Database

```bash
# Get database connection details
acli api:v3:site-instances:find-database <siteId> <environmentId>
acli api:v3:site-instances:find-database-connection <siteId> <environmentId>
```

### Database Backups

```bash
# List available backups
acli api:v3:site-instances:list-database-backups <siteId> <environmentId>

# Get details for a specific backup
acli api:v3:site-instances:find-database-backup <siteId> <environmentId> <backupId>

# Create a backup
acli api:v3:site-instances:create-database-backup <siteId> <environmentId>

# Restore a backup
acli api:v3:site-instances:restore-database-backup <siteId> <environmentId> <backupId>
```

> **Caution:** Restoring a backup overwrites the current database. This cannot be undone. Confirm with the user before executing.

---

## Copy Files or Database from Another Environment

```bash
# Copy files from another environment
acli api:v3:site-instances:copy-files <siteId> <environmentId> <source_environment_id>

# Copy database from another environment
acli api:v3:site-instances:copy-database <siteId> <environmentId> <source_environment_id>
```

> **Caution:** These operations overwrite the current files or database. Confirm with the user before executing.

---

## Cancel or Delete a Site Instance

```bash
# Dissociate a site from an environment (with grace period)
acli api:v3:site-instances:cancel <siteId> <environmentId>
```

### Schedule Deletion

> **Caution:** Schedules the site instance for deletion. Use `acli api:v3:site-instances:recover` within the grace period to cancel.

```bash
acli api:v3:site-instances:schedule-delete <siteId> <environmentId>
```

### Recover from Scheduled Deletion

```bash
acli api:v3:site-instances:recover <siteId> <environmentId>
```

---

## Wipe a Site Instance

> **Destructive operation — explicit approval required.**
> Resets the site instance database and files to a clean state. All content and configuration will be lost. This cannot be undone. Confirm with the user before executing.

```bash
acli api:v3:site-instances:wipe <siteId> <environmentId>
```

---

## Typical Workflows

### Refresh a staging site from production

```bash
# Copy database from prod environment
acli api:v3:site-instances:copy-database <siteId> <stagingEnvId> <prodEnvId>

# Copy files from prod environment
acli api:v3:site-instances:copy-files <siteId> <stagingEnvId> <prodEnvId>
```

### Create a backup before a risky operation

```bash
# Create backup
acli api:v3:site-instances:create-database-backup <siteId> <environmentId>

# List to get the backup ID
acli api:v3:site-instances:list-database-backups <siteId> <environmentId>

# If something goes wrong, restore
acli api:v3:site-instances:restore-database-backup <siteId> <environmentId> <backupId>
```

### Lock a site instance for maintenance

```bash
acli api:v3:site-instances:enable-protection-mode <siteId> <environmentId>
# ... perform maintenance ...
acli api:v3:site-instances:disable-protection-mode <siteId> <environmentId>
```

---

## Discover More Commands

```bash
acli list api:v3:site-instances
acli api:v3:site-instances:find --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model
- **[MEO Sites](../meo-sites/SKILL.md)** — Manage the site definition
- **[MEO Environments](../meo-environments/SKILL.md)** — Manage the environment containing this site instance
- **[MEO Deployments](../meo-deployments/SKILL.md)** — Track code deployment into this environment
