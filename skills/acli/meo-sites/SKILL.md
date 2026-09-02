---
name: meo-sites
description: "Use when listing, creating, updating, duplicating, recovering, or deleting MEO sites. Sites are the logical Drupal site definitions in a MEO multi-site subscription."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, sites, multi-site"
    software_requirements: "acli>=2.x"
---

# MEO Site Management

> **Platform:** This skill applies to **MEO (Multi-site Enterprise Operations)** subscriptions only.
> For ACE (Acquia Cloud Enterprise), see [Application Management](../application-management/SKILL.md).

Use when:
- Listing, inspecting, creating, or updating sites
- Duplicating an existing site to create a new one
- Scheduling a site for deletion or recovering it
- Finding which sites belong to a codebase or subscription

**Note:** All commands below use `acli api:v3:*` (V3 API). Run `acli list api:v3:sites` to see all current site commands.

---

## List Sites

```bash
# All sites you have access to
acli api:v3:sites:list

# Sites for a specific subscription
acli api:v3:subscriptions:list-sites <subscriptionId>

# Sites associated with a specific codebase
acli api:v3:codebases:list-sites <codebaseId>

# Sites in a specific environment
acli api:v3:environments:list-sites <environmentId>
```

Supports pagination: `--offset=<n>` and `--limit=<n>`.

---

## Get Site Details

```bash
acli api:v3:sites:find <siteId>
```

Returns site `id`, `name`, `label`, `codebase_id`, `status`, and timestamps.

---

## Create a Site

```bash
acli api:v3:sites:create <name> <label> <codebase_id>
```

| Argument | Required | Description |
|---|---|---|
| `name` | Yes | Machine name — lowercase letters and hyphens only, starts with a letter |
| `label` | Yes | Human-readable display name |
| `codebase_id` | Yes | UUID of the codebase this site will use |

```bash
# Example
acli api:v3:sites:create my-new-site "My New Site" d3b07384-d9a0-4568-b1c0-e1e23f123456
```

Optional flags: `--description="..."`, `--site_id=<uuid>` (supply your own UUID).

---

## Update a Site

```bash
acli api:v3:sites:update <siteId> --label="New Label" --description="Updated description"
```

Only `label` and `description` can be updated after creation.

---

## Duplicate a Site

Creates a new site by copying an existing one into one or more environments.

```bash
acli api:v3:sites:duplicate <sourceSiteId> <site_name> <site_label> <environment_mapping>
```

| Argument | Required | Description |
|---|---|---|
| `site_name` | Yes | Machine name for the new site |
| `site_label` | Yes | Display label for the new site |
| `environment_mapping` | Yes | JSON array mapping source to destination environments |

```bash
# Example — duplicate into the same environment
acli api:v3:sites:duplicate abc-site-uuid new-site "New Site" \
  '[{"source_environment_id":"env-uuid","destination_environment_id":"env-uuid"}]'
```

Optional: `--hook_argument="..."` passes a custom argument to duplication hooks.

---

## Schedule a Site for Deletion

> **Caution:** Schedules the site and all its site instances for deletion. Use `acli api:v3:sites:recover` within the grace period to cancel.

```bash
acli api:v3:sites:schedule-delete <siteId>
```

---

## Recover a Site Scheduled for Deletion

```bash
acli api:v3:sites:recover <siteId>
```

Cancels a pending scheduled deletion. Must be run before the grace period expires.

---

## Delete a Site

> **Destructive operation — explicit approval required.**
> Permanently deletes the site and all associated site instances. This cannot be undone. Confirm with the user before executing.

```bash
acli api:v3:sites:delete <siteId>
```

---

## Typical Workflows

### Provision a new site

```bash
# 1. Find the codebase UUID
acli api:v3:subscriptions:list-codebases <subscriptionId>

# 2. Create the site
acli api:v3:sites:create my-site "My Site" <codebaseId>

# 3. Associate it with an environment (creates a site instance)
acli api:v3:environments:create-site-instance <environmentId> <siteId>
```

### Clone a site for a new tenant

```bash
acli api:v3:sites:duplicate <originalSiteId> \
  tenant-new "Tenant New" \
  '[{"source_environment_id":"<envId>","destination_environment_id":"<envId>"}]'
```

---

## Discover More Commands

```bash
acli list api:v3:sites
acli list api:v3:subscriptions
acli api:v3:sites:create --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model, authentication
- **[MEO Codebases](../meo-codebases/SKILL.md)** — Manage the git repository backing your sites
- **[MEO Site Instances](../meo-site-instances/SKILL.md)** — Manage a site within a specific environment
- **[MEO Environments](../meo-environments/SKILL.md)** — Environment-level operations
