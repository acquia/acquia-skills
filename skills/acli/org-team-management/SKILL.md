---
name: org-team-management
description: "Use when managing Acquia Cloud organizations, teams, team members, team roles, or handling invitations to applications and organizations."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: access-management
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, organizations, teams, roles, invites, permissions"
    software_requirements: "acli>=2.x"
---

# Organization and Team Management with Acquia CLI

Use when:
- Listing or managing organization members and admins
- Creating teams and assigning members and roles
- Associating teams with applications
- Accepting, declining, or cancelling invitations
- Listing available permissions

---

## Organizations

### List organization members

```bash
acli api:organizations:member-list <organizationUuid>
```

### Add an admin to an organization

```bash
acli api:organizations:admin-add <organizationUuid> <userUuid>
```

### Remove an admin

```bash
acli api:organizations:admin-delete <organizationUuid> <userUuid>
```

### Find a member by email or name

```bash
acli api:organizations:member-find <organizationUuid> --filter=email@example.com
```

### List subscriptions for an organization

```bash
acli api:organizations:subscriptions-list <organizationUuid>
```

### Register a domain for an organization

```bash
acli api:organizations:domain-register <organizationUuid> --domain=example.com
```

---

## Teams

Teams group users and can be granted access to one or more applications.

### Create a team

```bash
acli api:tps:team-create <organizationUuid> --name="Backend Team"
```

### Add a member to a team

```bash
acli api:tps:team-member-add <teamUuid> --user-uuid=<userUuid>
```

### List members of a team

```bash
acli api:tps:team-member-list <teamUuid>
```

### Remove a member from a team

```bash
acli api:tps:team-member-delete <teamUuid> <userUuid>
```

### Assign an application to a team

```bash
acli api:tps:team-application-add <teamUuid> <applicationUuid>
```

### List applications a team has access to

```bash
acli api:tps:team-application-list <teamUuid>
```

### Remove application from a team

```bash
acli api:tps:team-application-delete <teamUuid> <applicationUuid>
```

### Find roles available for teams

```bash
acli api:tps:role-find
```

### Assign a role to a team member

```bash
acli api:tps:team-member-role-add <teamUuid> <userUuid> --role-uuid=<roleUuid>
```

---

## Invitations

### Accept an invitation

```bash
acli api:invites:accept <token>
```

### Decline an invitation

```bash
acli api:invites:decline <token>
```

### Cancel a pending invitation

```bash
acli api:invites:cancel <inviteUuid>
```

---

## Permissions

### List all available permissions

```bash
acli api:permissions:list
```

Returns all named permissions that can be assigned to roles in your organization.

---

## Typical Workflows

### Grant a new developer access to an application

```bash
# 1. Find or create the team for that application
acli api:tps:team-application-list <teamUuid>

# 2. Add the new developer to the team
acli api:tps:team-member-add <teamUuid> --user-uuid=<newUserUuid>

# 3. Assign an appropriate role
acli api:tps:team-member-role-add <teamUuid> <newUserUuid> --role-uuid=<roleUuid>
```

### Remove a developer who is leaving

```bash
# Remove from all relevant teams
acli api:tps:team-member-delete <teamUuid> <userUuid>

# If they were an org admin, remove that too
acli api:organizations:admin-delete <organizationUuid> <userUuid>
```

---

## Best Practices

1. **Use teams for application access** — Assign teams to applications rather than individual users; it scales better.
2. **Name teams by function** — e.g., "Frontend Team", "QA Team" — makes membership intent clear.
3. **Review permissions before assigning roles** — Run `api:permissions:list` to understand what a role grants.

---

## Related Topics

- **[Getting Started](../getting-started/SKILL.md)** — Authentication
- **[Application Management](../application-management/SKILL.md)** — Find application UUIDs
- **[Subscriptions](../subscriptions/SKILL.md)** — Subscription-level access controls
