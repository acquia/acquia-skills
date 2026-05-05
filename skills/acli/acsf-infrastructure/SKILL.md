---
name: acsf-infrastructure
description: "Use when monitoring ACSF service status, managing background tasks, controlling system updates, checking factory information, or configuring security settings on Acquia Cloud Site Factory."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: acsf
    author: Acquia
    version: "1.0.0"
    tags: "acli, acsf, acquia-cloud-site-factory, infrastructure, tasks, updates, security"
    software_requirements: "acli>=2.x"
---

# ACSF Infrastructure and Operations

Use when:
- Checking service health or modifying service status
- Monitoring, pausing, or terminating background tasks
- Controlling and monitoring system updates
- Checking factory info (stacks, audit events, VCS)
- Configuring factory-level security settings
- Pinging the API or regenerating API keys

> **Prerequisites:** Authenticate with ACSF first via `acli auth:acsf-login`. See **[Getting Started](../getting-started/SKILL.md)** for setup.

---

## Factory Information

### Get factory version and status

```bash
acli acsf:api:ping
```

Returns a ping response confirming the API is reachable.

```bash
acli acsf:api:factory-version
```

Returns the running factory version.

### Get stack and VCS information

```bash
acli acsf:info
```

Returns audit events, stack details, and VCS information for the factory.

---

## Stacks

Stacks are the infrastructure environments within a factory (e.g., production stack, staging stack).

### List stacks

```bash
acli acsf:stacks
```

### Edit a stack

```bash
acli acsf:stacks:edit --stack-id=<stack-id>
```

---

## Service Status

### Get current service status

```bash
acli acsf:service-status
```

Returns the operational status of factory services.

### Modify service status

```bash
acli acsf:service-status:modify
```

Use with caution — modifying service status affects all sites on the factory.

---

## Background Tasks

Background tasks are async operations (site creation, backup, duplication, etc.) running in the factory.

### Monitor tasks

```bash
acli acsf:tasks
```

Lists recent background tasks with their status (pending, in progress, completed, failed).

### Pause a task

```bash
acli acsf:tasks:pause --task-id=<task-id>
```

### Terminate a task

```bash
acli acsf:tasks:terminate --task-id=<task-id>
```

> **Note:** Terminating a task mid-execution may leave a site in an inconsistent state. Confirm the task ID and state before terminating.

---

## System Updates

### Check update status

```bash
acli acsf:updates
```

Returns current update status for the factory.

### Start an update

```bash
acli acsf:update:start
```

### Pause updates

```bash
acli acsf:update:pause
```

### Resume updates

```bash
acli acsf:update:resume
```

---

## Security Settings

### View security configuration

```bash
acli acsf:security
```

### Update security settings

```bash
acli acsf:security:update
```

Security settings control password policies, two-factor authentication requirements, and session management for the factory.

---

## API Key Management

### Regenerate API key for a specific user

```bash
acli acsf:api:regenerate-key --uid=<user-id>
```

### Regenerate all API keys

```bash
acli acsf:api:regenerate-all-keys
```

> **Warning:** Regenerating all keys invalidates every existing API key across the factory. All integrations using API keys will break until updated.

---

## Best Practices

1. **Monitor tasks after bulk operations** — After creating or duplicating many sites, check `acsf:tasks` to ensure no failures.
2. **Check service status before maintenance windows** — Run `acsf:service-status` before scheduling updates.
3. **Coordinate update windows** — Run `acsf:update:pause` to hold updates during high-traffic periods, then resume with `acsf:update:resume`.
4. **Avoid regenerating all keys without coordination** — Announce `acsf:api:regenerate-all-keys` to all API consumers before running.

---

## Related Topics

- **[ACSF Site Management](../acsf-site-management/SKILL.md)** — Create, backup, and manage sites
- **[ACSF Content/Config Management](../acsf-content/SKILL.md)** — Themes, cron, install profiles
- **[Getting Started](../getting-started/SKILL.md)** — Authentication setup
