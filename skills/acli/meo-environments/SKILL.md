---
name: meo-environments
description: "Use when managing MEO environments: inspecting environment details, enabling or disabling protection mode, clearing caches, managing deployments, site instances, egress IPs, private networks, trusted proxies, or domain patterns."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, environments, protection, deployment"
    software_requirements: "acli>=2.x"
---

# MEO Environment Management

> **Platform:** This skill applies to **MEO (Multi-site Enterprise Operations)** subscriptions only.
> For ACE environment management, see [Environment Management](../environment-management/SKILL.md).

Use when:
- Getting environment details in a MEO subscription
- Enabling or disabling environment protection mode
- Clearing caches across domains
- Creating, listing, or reordering site instances in an environment
- Managing deployments, egress IPs, private network, or trusted proxies
- Managing environment-level domain patterns

**Note:** All commands use `acli api:v3:*`. Run `acli list api:v3:environments` to see all current environment commands.

---

## Get Environment Details

```bash
acli api:v3:environments:find <environmentId>
```

Returns environment label, status, PHP version, region, codebase link, and server configuration.

```bash
# List environments for a codebase
acli api:v3:codebases:list-environments <codebaseId>

# List environments for a site
acli api:v3:sites:list-environments <siteId>
```

---

## Update Environment Properties

```bash
acli api:v3:environments:update <environmentId> \
  --label="Staging" \
  --description="..." \
  --properties='{"php_version":"8.2"}'
```

---

## Protection Mode

Protection mode prevents destructive operations from being performed on the environment.

```bash
# Enable — locks environment against wipes, deletes, and risky deployments
acli api:v3:environments:enable-protection-mode <environmentId>

# Disable — allows destructive operations to proceed
acli api:v3:environments:disable-protection-mode <environmentId>
```

---

## Clear Caches

```bash
acli api:v3:environments:clear-caches <environmentId> <domains>
```

`domains` is a space-separated list of domain names to clear:

```bash
acli api:v3:environments:clear-caches <environmentId> example.com www.example.com
```

---

## Site Instance Management

```bash
# List site instances in this environment
acli api:v3:environments:list-site-instances <environmentId>

# Associate a site with this environment (creates a site instance)
acli api:v3:environments:create-site-instance <environmentId> <site_id>

# Optional: copy files and database from a source environment during creation
acli api:v3:environments:create-site-instance <environmentId> <site_id> \
  --source_environment_id=<srcEnvId> \
  --source_site_id=<srcSiteId>

# Reorder site instances (affects display order)
acli api:v3:environments:reorder-site-instances <environmentId> ...
```

---

## Deployments

```bash
# List deployments for this environment
acli api:v3:environments:list-deployments <environmentId>

# Start a deployment (deploy a branch or tag)
acli api:v3:environments:create-deployment <environmentId> <run_hooks> <code_reference>
```

| Argument | Description |
|---|---|
| `run_hooks` | `true` or `false` — whether to execute deployment hooks |
| `code_reference` | Branch or tag name (e.g. `refs/heads/main`) |

```bash
# Example
acli api:v3:environments:create-deployment <environmentId> true refs/heads/main
```

Returns a `deploymentId`. Track progress with `acli api:v3:deployments:find <deploymentId>`.

---

## Code Deploy Concurrency

```bash
# Get current concurrency setting
acli api:v3:environments:find-code-deploy <environmentId>

# Update concurrency (max concurrent site deployments)
acli api:v3:environments:update-code-deploy <environmentId> <concurrency>
```

---

## CDN Purge

```bash
# Purge CDN cache for specific content
acli api:v3:environments:purge-cdn <environmentId> <resource_type> --values='["value1","value2"]'
```

`resource_type` options: `url`, `tag`, `all`

---

## Egress IPs

```bash
acli api:v3:environments:list-egress-ips <environmentId>
```

Returns the outbound IP addresses for this environment (useful for allowlisting).

---

## Private Network

```bash
# Check private network association
acli api:v3:environments:find-private-network <environmentId>

# Associate with a private network
acli api:v3:environments:associate-private-network <environmentId> <private_network_id>
```

> **Caution:** Disassociating removes network isolation. Confirm with the user before executing.

```bash
acli api:v3:environments:disassociate-private-network <environmentId>
```

---

## Trusted Proxies

```bash
# Get trusted proxy configuration
acli api:v3:environments:find-trusted-proxies <environmentId>

# Update trusted proxies
acli api:v3:environments:update-trusted-proxies <environmentId> ...
```

---

## Domain Patterns

```bash
# List domain patterns
acli api:v3:environments:list-domain-patterns <environmentId>

# Create a domain pattern
acli api:v3:environments:create-domain-pattern <environmentId> ...

# Find, update a pattern
acli api:v3:environments:find-domain-pattern <environmentId> <patternId>
acli api:v3:environments:update-domain-pattern <environmentId> <patternId> ...
```

> **Destructive operation — explicit approval required.**
> Deleting a domain pattern removes URL routing rules and may break site access. Confirm with the user before executing.

```bash
acli api:v3:environments:delete-domain-pattern <environmentId> <patternId>
```

---

## Multi-Region Failover

```bash
# Get failover status
acli api:v3:environments:find-multi-region-failover <environmentId>

# Enable multi-region failover
acli api:v3:environments:update-multi-region-failover <environmentId>

# Disable multi-region failover
acli api:v3:environments:delete-multi-region-failover <environmentId>
```

---

## Typical Workflows

### Deploy a new release

```bash
# 1. Start the deployment
acli api:v3:environments:create-deployment <environmentId> true refs/heads/release/1.5

# 2. Track the deployment
acli api:v3:deployments:find <deploymentId>
```

### Lock an environment before maintenance

```bash
acli api:v3:environments:enable-protection-mode <environmentId>
# ... perform maintenance ...
acli api:v3:environments:disable-protection-mode <environmentId>
```

---

## Discover More Commands

```bash
acli list api:v3:environments
acli api:v3:environments:create-deployment --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model
- **[MEO Sites](../meo-sites/SKILL.md)** — Manage sites
- **[MEO Site Instances](../meo-site-instances/SKILL.md)** — Per-site operations within this environment
- **[MEO Deployments](../meo-deployments/SKILL.md)** — Monitor and control running deployments
- **[MEO CDN & Security](../meo-cdn-security/SKILL.md)** — CDN purge, security rules
