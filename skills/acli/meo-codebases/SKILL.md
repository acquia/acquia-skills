---
name: meo-codebases
description: "Use when managing MEO codebases: listing, inspecting, updating, or deleting codebases, browsing git references, or managing domain patterns for a codebase."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, codebases, git, multi-site"
    software_requirements: "acli>=2.x"
---

# MEO Codebase Management

> **Platform:** This skill applies to **MEO (Multi-site Enterprise Operations)** subscriptions only.

Use when:
- Listing or inspecting codebases for a subscription
- Browsing git branches and tags (references) available in a codebase
- Creating a new codebase for a subscription
- Managing domain routing patterns on a codebase

**Note:** All commands use `acli api:v3:*`. Run `acli list api:v3:codebases` to see all current codebase commands.

---

## List Codebases

```bash
# Codebases for a subscription
acli api:v3:subscriptions:list-codebases <subscriptionId>

# All codebases you have access to
acli api:v3:codebases:list
```

---

## Get Codebase Details

```bash
acli api:v3:codebases:find <codebaseId>
```

Returns `id`, `label`, `region`, `vcs_url`, `status`, and linked subscription.

---

## Create a Codebase

```bash
acli api:v3:subscriptions:create-codebase <subscriptionId> <codebase_id> <label> <region>
```

| Argument | Required | Description |
|---|---|---|
| `subscriptionId` | Yes | UUID of the subscription |
| `codebase_id` | Yes | Client-supplied UUID for the new codebase |
| `label` | Yes | Human-readable name |
| `region` | Yes | AWS region (e.g. `us-east-1`) |

---

## Update a Codebase

```bash
acli api:v3:codebases:update <codebaseId> --label="New Label" --description="..."
```

---

## Delete a Codebase

> **Destructive operation — explicit approval required.**
> Permanently deletes the codebase. All sites referencing this codebase must be deleted first. This cannot be undone. Confirm with the user before executing.

```bash
acli api:v3:codebases:delete <codebaseId>
```

---

## List Environments for a Codebase

```bash
acli api:v3:codebases:list-environments <codebaseId>
```

Returns all environments that have site instances built from this codebase.

---

## List Sites for a Codebase

```bash
acli api:v3:codebases:list-sites <codebaseId>
```

---

## Browse Git References (Branches & Tags)

```bash
# List all branches and tags
acli api:v3:codebases:list-references <codebaseId>

# Get details for a specific reference
acli api:v3:codebases:find-reference <codebaseId> <referenceName>
```

`referenceName` examples: `refs/heads/main`, `refs/tags/1.2.0`

---

## Domain Patterns

Domain patterns define URL routing rules for sites in this codebase.

```bash
# List domain patterns
acli api:v3:codebases:list-domain-patterns <codebaseId>

# Create a domain pattern
acli api:v3:codebases:create-domain-pattern <codebaseId> ...

# Update a domain pattern
acli api:v3:codebases:update-domain-pattern <codebaseId> <patternId> ...

# Get a specific pattern
acli api:v3:codebases:find-domain-pattern <codebaseId> <patternId>
```

> **Destructive operation — explicit approval required.**
> Deleting a domain pattern removes URL routing rules and may break site access. Confirm with the user before executing.

```bash
acli api:v3:codebases:delete-domain-pattern <codebaseId> <patternId>
```

---

## Typical Workflows

### Inspect a codebase and its git branches

```bash
# Find the codebase
acli api:v3:subscriptions:list-codebases <subscriptionId>

# Browse available branches
acli api:v3:codebases:list-references <codebaseId>

# Confirm the branch you want to deploy exists
acli api:v3:codebases:find-reference <codebaseId> refs/heads/main
```

### Provision a new codebase

```bash
# Generate a UUID (or use your own)
CODEBASE_UUID=$(python3 -c "import uuid; print(uuid.uuid4())")

acli api:v3:subscriptions:create-codebase <subscriptionId> \
  "$CODEBASE_UUID" \
  "My Codebase" \
  us-east-1
```

---

## Discover More Commands

```bash
acli list api:v3:codebases
acli list api:v3:subscriptions
acli api:v3:codebases:list-references --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model
- **[MEO Sites](../meo-sites/SKILL.md)** — Sites that reference this codebase
- **[MEO Environments](../meo-environments/SKILL.md)** — Where code from this codebase runs
- **[MEO Deployments](../meo-deployments/SKILL.md)** — Deploy a branch from this codebase
