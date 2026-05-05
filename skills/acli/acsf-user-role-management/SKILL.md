---
name: acsf-user-role-management
description: "Use when creating, updating, or deleting ACSF users, managing roles and permissions, or organizing sites into groups on Acquia Cloud Site Factory."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: acsf
    author: Acquia
    version: "1.0.0"
    tags: "acli, acsf, acquia-cloud-site-factory, users, roles, groups"
    software_requirements: "acli>=2.x"
---

# ACSF User, Role, and Group Management

Use when:
- Creating, finding, updating, or deleting ACSF users
- Managing roles and their permissions
- Organizing sites into groups
- Adding or removing members and sites from groups

> **Prerequisites:** Authenticate with ACSF first via `acli auth:acsf-login`. See **[Getting Started](../getting-started/SKILL.md)** for setup.

---

## Users

### Create a user

```bash
acli acsf:users:create \
  --username=jsmith \
  --mail=jsmith@example.com \
  --password=SecurePass123
```

### Find a user

```bash
acli acsf:users:find --username=jsmith
```

### Get user details

```bash
acli acsf:users:get --uid=<user-id>
```

### Update a user

```bash
acli acsf:users:update \
  --uid=<user-id> \
  --mail=new@example.com
```

### Delete a user

```bash
acli acsf:users:delete --uid=<user-id>
```

> **Note:** Deleting a user does not delete their sites. Reassign site ownership first if needed.

---

## Roles

Roles control what users can do within the ACSF factory.

### List available roles

```bash
acli acsf:roles
```

### Assign a role to a user

Roles are typically assigned during user creation or update. Check your factory's role IDs first:

```bash
acli acsf:roles
```

Then assign via update:

```bash
acli acsf:users:update \
  --uid=<user-id> \
  --roles=<role-id>
```

---

## Groups

Groups let you organize sites for bulk operations and permission scoping.

### Create a group

```bash
acli acsf:groups:create --group-name=my-group
```

### Find a group

```bash
acli acsf:groups:find --group-name=my-group
```

### Edit a group

```bash
acli acsf:groups:edit \
  --group-id=<group-id> \
  --group-name=updated-name
```

### Delete a group

```bash
acli acsf:groups:delete --group-id=<group-id>
```

---

## Group Membership — Members

### Add members to a group

```bash
acli acsf:groups:add-members \
  --group-id=<group-id> \
  --uids=<uid1>,<uid2>
```

### Remove members from a group

```bash
acli acsf:groups:remove-members \
  --group-id=<group-id> \
  --uids=<uid1>
```

---

## Group Membership — Sites

### Add sites to a group

```bash
acli acsf:groups:add-sites \
  --group-id=<group-id> \
  --site-ids=<site-id1>,<site-id2>
```

### Remove sites from a group

```bash
acli acsf:groups:remove-sites \
  --group-id=<group-id> \
  --site-ids=<site-id1>
```

---

## Typical Workflows

### Onboard a new developer

```bash
# Create user
acli acsf:users:create --username=newdev --mail=newdev@example.com

# Find user ID
acli acsf:users:find --username=newdev

# Add to relevant group
acli acsf:groups:add-members --group-id=<group-id> --uids=<uid>
```

### Offboard a developer

```bash
# Find the user
acli acsf:users:find --username=leaving-dev

# Remove from all groups first (optional but tidy)
acli acsf:groups:remove-members --group-id=<group-id> --uids=<uid>

# Delete the user
acli acsf:users:delete --uid=<uid>
```

---

## Best Practices

1. **Use groups for permission scoping** — Assign sites to groups so developers only see the sites relevant to them.
2. **Verify role IDs** — Run `acsf:roles` before assigning to ensure you're using the correct role.
3. **Reassign site ownership before deleting users** — Prevents orphaned sites.

---

## Related Topics

- **[ACSF Site Management](../acsf-site-management/SKILL.md)** — Create and manage sites
- **[ACSF Infrastructure](../acsf-infrastructure/SKILL.md)** — Service status and updates
