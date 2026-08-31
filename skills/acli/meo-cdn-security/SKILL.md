---
name: meo-cdn-security
description: "Use when managing MEO CDN domains, security rulesets, IP rules, custom security rules, rate limiting rules, failover groups, or purging CDN cache for a subscription or environment."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: security
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, cdn, security, ip-rules, rate-limiting, failover"
    software_requirements: "acli>=2.x"
---

# MEO CDN & Security

> **Platform:** This skill applies to **MEO (Multi-site Enterprise Operations)** subscriptions only.
> These are [development-stability] commands and may change without notice.

Use when:
- Listing or provisioning CDN domains for a subscription
- Purging CDN cache for an environment
- Managing security rulesets, IP rules, custom rules, or rate limiting rules
- Configuring multi-region failover groups

**Note:** All commands use `acli api:v3:*`. Run `acli list api:v3:subscriptions` and `acli list api:v3:failover-groups` to see all current commands.

---

## CDN Domains

```bash
# List CDN domains for a subscription
acli api:v3:subscriptions:list-domains <subscriptionUuid>

# Get details for a specific domain
acli api:v3:subscriptions:find-domain <subscriptionUuid> <domainName>
```

### Provision a Domain for CDN

```bash
acli api:v3:subscriptions:provision-domain <subscriptionUuid> <domainName> <environment_id>
```

### Deprovision a Domain from CDN

> **Caution:** Removes CDN acceleration for the domain. Traffic routing may change. Confirm with the user before executing.

```bash
acli api:v3:subscriptions:deprovision-domain <subscriptionUuid> <domainName>
```

---

## CDN Cache Purge

```bash
# Purge by URL
acli api:v3:environments:purge-cdn <environmentId> url --values='["https://example.com/page"]'

# Purge by cache tag
acli api:v3:environments:purge-cdn <environmentId> tag --values='["node:123","term:456"]'

# Purge everything
acli api:v3:environments:purge-cdn <environmentId> all
```

---

## Security Rulesets

Rulesets are predefined security configurations that can be enabled or disabled:

```bash
# List available rulesets
acli api:v3:subscriptions:list-security-rule-sets <subscriptionUuid>

# Get details for a specific ruleset
acli api:v3:subscriptions:find-security-rule-set <subscriptionUuid> <ruleSetId>

# Enable or disable a ruleset
acli api:v3:subscriptions:update-security-rule-set <subscriptionUuid> <ruleSetId> <is_enabled>
```

---

## IP Rules

IP rules allow or block specific IP addresses or CIDR blocks:

```bash
# List IP rules
acli api:v3:subscriptions:list-ip-rules <subscriptionUuid>

# Get a specific rule
acli api:v3:subscriptions:find-ip-rule <subscriptionUuid> <ipRuleId>

# Create an IP rule
acli api:v3:subscriptions:create-ip-rule <subscriptionUuid> <ips> <action> <display_name>
```

| Argument | Description |
|---|---|
| `ips` | Space-separated IPs or CIDR blocks (e.g. `192.168.1.1 10.0.0.0/24`) |
| `action` | `allow` or `block` |
| `display_name` | Friendly name for the rule |

```bash
# Example: Block a known bad actor
acli api:v3:subscriptions:create-ip-rule <subscriptionUuid> \
  "203.0.113.0/24" block "Block suspicious range"
```

```bash
# Update an IP rule
acli api:v3:subscriptions:update-ip-rule <subscriptionUuid> <ipRuleId> \
  --display_name="Updated rule" --action=allow
```

> **Destructive operation — explicit approval required.**
> Deleting an IP rule removes access control for those IPs. Confirm with the user before executing.

```bash
acli api:v3:subscriptions:delete-ip-rule <subscriptionUuid> <ipRuleId>
```

---

## Custom Security Rules

Custom rules add fine-grained WAF-style control by domain and path:

```bash
# List custom rules
acli api:v3:subscriptions:list-custom-rules <subscriptionUuid>

# Create a custom rule
acli api:v3:subscriptions:create-custom-rule <subscriptionUuid> \
  <display_name> <action> <domains> <paths>
```

```bash
# Get or update a rule
acli api:v3:subscriptions:find-custom-rule <subscriptionUuid> <customRuleId>
acli api:v3:subscriptions:update-custom-rule <subscriptionUuid> <customRuleId> ...
```

> **Destructive operation — explicit approval required.**
> Deleting a custom security rule removes that protection. Confirm with the user before executing.

```bash
acli api:v3:subscriptions:delete-custom-rule <subscriptionUuid> <customRuleId>
```

---

## Rate Limiting Rules

```bash
# List rate limiting rules
acli api:v3:subscriptions:list-rate-limiting-rules <subscriptionUuid>

# Create a rate limiting rule
acli api:v3:subscriptions:create-rate-limiting-rule <subscriptionUuid> \
  <display_name> <action> <rate_limit_per_minute>
```

```bash
# Get, update a rule
acli api:v3:subscriptions:find-rate-limiting-rule <subscriptionUuid> <rateLimitingRuleId>
acli api:v3:subscriptions:update-rate-limiting-rule <subscriptionUuid> <rateLimitingRuleId> ...
```

> **Destructive operation — explicit approval required.**
> Deleting a rate limiting rule removes traffic protection. Confirm with the user before executing.

```bash
acli api:v3:subscriptions:delete-rate-limiting-rule <subscriptionUuid> <rateLimitingRuleId>
```

---

## Failover Groups

Failover groups manage multi-region redundancy for MEO environments:

```bash
# List failover groups
acli api:v3:failover-groups:list

# Get a failover group
acli api:v3:failover-groups:find <failoverGroupId>

# Create a failover group
acli api:v3:failover-groups:create <name>
```

### Initiate Failover

> **Destructive operation — explicit approval required.**
> Initiates failover, switching traffic from the primary region to the secondary. This affects all live traffic. Confirm with the user before executing.

```bash
acli api:v3:failover-groups:failover <failoverGroupId>
```

### Revert Failover

> **Destructive operation — explicit approval required.**
> Reverts failover, switching traffic back to the primary region. Confirm with the user before executing.

```bash
acli api:v3:failover-groups:revert-failover <failoverGroupId>
```

### Sync a Failover Group

```bash
acli api:v3:failover-groups:sync <failoverGroupId>
```

### Delete a Failover Group

> **Destructive operation — explicit approval required.**
> Permanently removes the failover group. Confirm with the user before executing.

```bash
acli api:v3:failover-groups:delete <failoverGroupId>
```

---

## Discover More Commands

```bash
acli list api:v3:subscriptions
acli list api:v3:failover-groups
acli api:v3:subscriptions:create-ip-rule --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model
- **[MEO Environments](../meo-environments/SKILL.md)** — Environment-level CDN purge
- **[MEO Identity & Access](../meo-identity-access/SKILL.md)** — SSO and federated authentication
