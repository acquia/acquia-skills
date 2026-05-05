---
name: codebase-management
description: "Use when creating, deleting, or listing Acquia Cloud codebases, or performing bulk code switches across multiple environments."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, codebases, deployment, code-switch"
    software_requirements: "acli>=2.x"
---

# Codebase Management with Acquia CLI

Use when:
- Creating or deleting codebases
- Listing available codebases and their branches/tags
- Performing bulk code switches across multiple environments simultaneously

> **Codebase vs Application:** A codebase is a shared git repository that can back multiple Acquia applications. Use codebase commands when managing the repository itself or deploying the same commit across applications.

---

## List Codebases

```bash
acli api:codebases:list
```

Returns all codebases your account has access to, with their UUIDs and associated applications.

---

## List References (Branches and Tags)

```bash
acli api:codebases:references-list <codebaseUuid>
```

Returns all branches and tags available in the codebase repository. Use these reference names when deploying.

---

## Create a Codebase

```bash
acli api:codebases:create \
  --label="My New Codebase" \
  --repo-url=git@github.com:myorg/myrepo.git
```

---

## Update a Codebase

```bash
acli api:codebases:update <codebaseUuid> \
  --label="Renamed Codebase"
```

---

## Delete a Codebase

```bash
acli api:codebases:delete <codebaseUuid>
```

> **Warning:** Deleting a codebase removes the repository connection. Applications backed by it will lose their code source. Ensure no environments depend on it before deleting.

---

## Bulk Code Switch

Switch all environments associated with a codebase to a specific branch or tag simultaneously:

```bash
acli api:codebases:bulk-code-switch:start <codebaseUuid> \
  --vcs-path=main
```

This is useful for coordinating releases across multiple applications that share a codebase.

### Check bulk switch status

Bulk code switches are async operations. Poll for completion:

```bash
acli app:task-wait <notificationUuid>
```

The notification UUID is returned by the `bulk-code-switch:start` command.

---

## Typical Workflow: Deploy a Release Across All Environments

```bash
# 1. Find the codebase
acli api:codebases:list

# 2. Confirm the branch exists
acli api:codebases:references-list <codebaseUuid>

# 3. Start the bulk switch
acli api:codebases:bulk-code-switch:start <codebaseUuid> --vcs-path=release/v2.0

# 4. Wait for completion
acli app:task-wait <notificationUuid>
```

---

## Best Practices

1. **Confirm the branch exists before bulk switching** — Run `references-list` first; switching to a non-existent branch fails silently on some environments.
2. **Use `app:task-wait` in CI** — Bulk switches are async; block your pipeline until the switch completes.
3. **Prefer bulk switch for coordinated releases** — More reliable than switching each application individually.

---

## Related Topics

- **[Environment Management](../environment-management/SKILL.md)** — Deploy code to individual environments
- **[Application Management](../application-management/SKILL.md)** — Find application UUIDs
- **[Pull & Push](../pull-push/SKILL.md)** — Push code artifacts
