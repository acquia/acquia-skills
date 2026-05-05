---
name: acsf-site-management
description: "Use when creating, finding, deleting, backing up, restoring, or duplicating sites on Acquia Cloud Site Factory (ACSF), or managing site ownership and domains."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: acsf
    author: Acquia
    version: "1.0.0"
    tags: "acli, acsf, acquia-cloud-site-factory, sites, domains, backup"
    software_requirements: "acli>=2.x"
---

# ACSF Site Management

Use when:
- Creating, finding, or deleting ACSF sites
- Backing up or restoring a site
- Duplicating a site to a new environment
- Clearing a site's cache
- Transferring or updating site ownership
- Managing site domains

> **Prerequisites:** Authenticate with ACSF first via `acli auth:acsf-login`. See **[Getting Started](../getting-started/SKILL.md)** for setup.

---

## Create a Site

```bash
acli acsf:sites:create
```

Non-interactive:

```bash
acli acsf:sites:create \
  --stack-id=1 \
  --site-name=my-new-site \
  --install-profile=standard
```

---

## Find a Site

Search for sites by name or other criteria:

```bash
acli acsf:sites:find
```

Non-interactive:

```bash
acli acsf:sites:find --site-name=my-site
```

---

## Get Site Details

```bash
acli acsf:sites:get --site-id=<site-id>
```

Returns the site's name, domain, stack, owner, and status.

---

## Delete a Site

```bash
acli acsf:sites:delete --site-id=<site-id>
```

> **Warning:** Permanent and cannot be undone. Confirm the site ID before running.

---

## Back Up a Site

Create an on-demand backup:

```bash
acli acsf:sites:backup --site-id=<site-id>
```

Options:

```bash
acli acsf:sites:backup \
  --site-id=<site-id> \
  --label="Pre-deployment backup" \
  --components=codebase,database,public files,private files,themes
```

Components default to all if omitted.

---

## Restore a Site from Backup

```bash
acli acsf:sites:restore-backup \
  --site-id=<site-id> \
  --backup-id=<backup-id>
```

To find available backups, use `acsf:info` or the ACSF UI.

---

## Duplicate a Site

Copy a site (code, database, files) to a new site:

```bash
acli acsf:sites:duplicate \
  --site-id=<source-site-id> \
  --site-name=my-duplicate-site \
  --stack-id=1
```

---

## Clear a Site's Cache

```bash
acli acsf:sites:clear-cache --site-id=<site-id>
```

---

## Site Ownership

### Transfer ownership

```bash
acli acsf:site-owner:transfer \
  --site-id=<site-id> \
  --new-owner=<username>
```

### Set owner

```bash
acli acsf:site-owner:set \
  --site-id=<site-id> \
  --owner=<username>
```

### Remove owner

```bash
acli acsf:site-owner:delete --site-id=<site-id>
```

---

## Domain Management

### Add a domain

```bash
acli acsf:domains:add \
  --site-id=<site-id> \
  --domain=www.example.com
```

### Remove a domain

```bash
acli acsf:domains:remove \
  --site-id=<site-id> \
  --domain=www.example.com
```

### Get domains for a site

```bash
acli acsf:domains:get --site-id=<site-id>
```

### Get all domains across factory

```bash
acli acsf:domains:get-all
```

### Check domain status

```bash
acli acsf:domains:get-status --domain=www.example.com
```

### Standard domain templates

```bash
# List standard templates
acli acsf:domains:get-std-templates

# Set standard templates
acli acsf:domains:set-std-templates

# Remove standard templates
acli acsf:domains:remove-std-templates

# Backfill standard domains
acli acsf:domains:backfill-std
```

---

## Stage Sites (stage-v2)

Stage sites from production to a staging environment:

```bash
acli acsf:stage-v2
```

This copies selected sites (code, database, files) to the staging stack for testing.

---

## Best Practices

1. **Always back up before destructive operations** — Run `acsf:sites:backup` before deleting or restoring.
2. **Use labels on backups** — Makes identifying the right backup easier when restoring.
3. **Verify site ID before deleting** — Use `acsf:sites:get` to confirm you have the right site.
4. **Check domain status after adding** — Run `acsf:domains:get-status` to confirm propagation.

---

## Related Topics

- **[ACSF User/Role/Group Management](../acsf-user-role-management/SKILL.md)** — Manage who has access to sites
- **[ACSF Infrastructure](../acsf-infrastructure/SKILL.md)** — Stacks, tasks, and service status
- **[Getting Started](../getting-started/SKILL.md)** — Authentication setup
