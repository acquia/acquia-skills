---
name: meo-overview
description: "Use when determining whether to use ACE (V2) or MEO (V3) commands, or when starting work on a MEO multi-site subscription for the first time."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: onboarding
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, multi-site, overview"
    software_requirements: "acli>=2.x"
---

# MEO (Multi-site Enterprise Operations) Overview

Use when:
- Determining whether a subscription uses ACE or MEO
- Starting work on a MEO multi-site subscription
- Choosing between `acli api:*` (ACE) and `acli api:v3:*` (MEO) commands
- Discovering which MEO commands are available

---

## ACE vs MEO — Choosing the Right Commands

Acquia Cloud Platform has two subscription types, each with its own API and CLI command prefix:

| | ACE (Acquia Cloud Enterprise) | MEO (Multi-site Enterprise Operations) |
|---|---|---|
| **CLI prefix** | `acli api:*` | `acli api:v3:*` |
| **API version** | V2 (`cloud.acquia.com/api`) | V3 (`api.acquia.com/v3`) |
| **Model** | One application → multiple environments, one Drupal site per environment | Subscription → Codebases + Environments → Sites → Site Instances (many Drupal sites per environment) |
| **Use case** | Single-site per environment | Multiple Drupal sites sharing an environment |

**How to tell which type a subscription is:** Look at the available commands. If `acli api:v3:sites:list` returns results, it is MEO. If `acli api:applications:list` is the primary entry point, it is ACE.

---

## MEO Resource Model

```
Subscription
├── Codebases (shared git repos)
│   └── References (branches / tags)
└── Environments (runtime containers)
    ├── Site Instances (one per Site per Environment)
    │   ├── Domains
    │   └── Database + Backups
    └── Deployments (code deploy operations)

Sites (logical Drupal sites, linked to a Codebase)
    └── Site Instances (a Site deployed into an Environment)
```

Key relationships:
- A **Codebase** holds the shared git repository
- A **Site** is the logical definition of a Drupal site, referencing a Codebase
- An **Environment** is where code runs (prod, staging, dev, etc.)
- A **Site Instance** is a Site running inside an Environment (has its own database and domain)

---

## Authentication

MEO uses the same Acquia Cloud credentials as ACE:

```bash
acli auth:login
acli auth:me
```

No separate login is needed. The `api:v3:*` commands automatically use the V3 API endpoint (`https://api.acquia.com/v3`).

For scripts and CI/CD:

```bash
export ACQUIA_KEY="your-api-key"
export ACQUIA_SECRET="your-api-secret"
acli api:v3:sites:list
```

---

## Discovering MEO Commands

MEO commands are generated dynamically from the V3 API spec. To see all currently available commands:

```bash
# List all V3 namespaces
acli list api:v3

# List commands for a specific resource
acli list api:v3:sites
acli list api:v3:codebases
acli list api:v3:environments
acli list api:v3:site-instances
acli list api:v3:deployments
acli list api:v3:subscriptions
acli list api:v3:failover-groups
acli list api:v3:identity-providers
acli list api:v3:sso-domains
```

```bash
# Get full help for any command (parameters, examples)
acli api:v3:sites:list --help
acli api:v3:sites:create --help
```

As new endpoints are added to the V3 API spec, they appear automatically in `acli list api:v3` — no skill update required.

---

## Command Stability

| Stability | Meaning |
|---|---|
| **production** | Stable, fully supported |
| **development** | Available but may change; use with awareness |

Current production-stable namespaces: `sites`, `codebases`, core subscription commands.

Development-stability namespaces: `environments`, `site-instances`, `deployments`, `failover-groups`, `subscriptions` (security/CDN), `identity-providers`, `sso-domains`.

---

## Quick Start: Find Your Resources

```bash
# Find sites you have access to
acli api:v3:sites:list

# Find codebases for a subscription
acli api:v3:subscriptions:list-codebases <subscriptionId>

# Find environments for a codebase
acli api:v3:codebases:list-environments <codebaseId>

# Find site instances in an environment
acli api:v3:environments:list-site-instances <environmentId>
```

---

## Related MEO Skills

- **[MEO Sites](../meo-sites/SKILL.md)** — Create, update, duplicate, delete sites
- **[MEO Codebases](../meo-codebases/SKILL.md)** — Manage codebases and git references
- **[MEO Environments](../meo-environments/SKILL.md)** — Environment operations, protection mode, deployments
- **[MEO Site Instances](../meo-site-instances/SKILL.md)** — Site instance lifecycle, domains, databases
- **[MEO Deployments](../meo-deployments/SKILL.md)** — Monitor and control deployments
- **[MEO CDN & Security](../meo-cdn-security/SKILL.md)** — CDN, IP rules, custom rules, rate limiting
- **[MEO Identity & Access](../meo-identity-access/SKILL.md)** — SSO domains, identity providers
- **[MEO Translation Layer](../meo-translation-layer/SKILL.md)** — ACE env variables, crons, mod-proxy, StackMetrics via the v3 gateway

## ACE Skills (V2 only)

- **[Application Management](../application-management/SKILL.md)** — ACE applications
- **[Environment Management](../environment-management/SKILL.md)** — ACE environments
- **[Pull & Push](../pull-push/SKILL.md)** — ACE code/DB/file sync
