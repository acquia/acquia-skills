---
name: subscriptions
description: "Use when managing Acquia Cloud subscription entitlements, Shield ACL rules, or domain registrations at the subscription level."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: access-management
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, subscriptions, shield, acl, entitlements, domains"
    software_requirements: "acli>=2.x"
---

# Subscription Management with Acquia CLI

Use when:
- Listing applications or entitlements within a subscription
- Managing Shield ACL rules (IP allowlists)
- Registering or listing domains at the subscription level

---

## List Subscription Applications

```bash
acli api:subscriptions:application-list <subscriptionUuid>
```

Returns all applications that belong to the subscription.

---

## Entitlements

Entitlements define what features and resources a subscription includes (e.g., number of environments, CDEs, storage).

### List entitlements

```bash
acli api:subscriptions:entitlements-list <subscriptionUuid>
```

---

## Shield ACL (IP Allowlisting)

Shield is an Acquia add-on that restricts access to your environments by IP address. ACL rules define which IP ranges are allowed.

### List Shield ACL rules

```bash
acli api:subscriptions:shield-acl-list <subscriptionUuid>
```

### Add a Shield ACL rule

```bash
acli api:subscriptions:shield-acl-create <subscriptionUuid> \
  --address=203.0.113.0/24 \
  --label="Office network"
```

### Update a Shield ACL rule

```bash
acli api:subscriptions:shield-acl-update \
  <subscriptionUuid> \
  <aclUuid> \
  --address=203.0.113.10/32 \
  --label="Updated office IP"
```

### Delete a Shield ACL rule

```bash
acli api:subscriptions:shield-acl-delete <subscriptionUuid> <aclUuid>
```

> **Warning:** Removing the wrong ACL rule may lock out legitimate users. Verify the rule before deleting.

---

## Domain Registrations

### List registered domains

```bash
acli api:subscriptions:domain-registrations-list <subscriptionUuid>
```

---

## Finding Your Subscription UUID

If you don't know your subscription UUID, list your applications and look for the `subscription` field:

```bash
acli api:applications:list
```

Or check the Acquia Cloud UI under **Subscription** settings.

---

## Best Practices

1. **Label every Shield ACL rule** — Makes it clear what each IP range is for; critical when rules need to be removed later.
2. **Use CIDR ranges, not single IPs, for team access** — Reduces churn as individual IPs change.
3. **Audit ACL rules regularly** — Remove stale rules for IPs no longer in use to minimize the attack surface.

---

## Related Topics

- **[Private Networks](../private-networks/SKILL.md)** — VPC and VPN for deeper network isolation
- **[Identity Providers](../identity-providers/SKILL.md)** — SSO for access control
- **[Org and Team Management](../org-team-management/SKILL.md)** — User and team access
