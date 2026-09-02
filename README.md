# Acquia Skills

Agent Skills for [Acquia CLI](https://docs.acquia.com/acquia-cli/), [Pipelines CLI](https://docs.acquia.com/acquia-cloud-platform/pipelines/), Drupal dependency management, and end-to-end deployment playbooks. Compatible with Claude Code, GitHub Copilot, Cursor, Gemini CLI, and any tool that supports the [agentskills.io](https://agentskills.io) format.

## Skills

### `acli` — Acquia CLI

#### ACE (Acquia Cloud Enterprise) — `acli api:*`

| Skill | Description |
|-------|-------------|
| `getting-started` | Install and authenticate acli for the first time |
| `application-management` | List applications, link repos, check VCS status (ACE only) |
| `environment-management` | List, create, delete, and mirror Cloud environments (ACE only) |
| `ide-management` | Create, list, open, and manage Cloud IDEs (ACE only) |
| `pull-push` | Sync code, database, and files between local and Cloud (ACE only) |
| `remote-access` | SSH into environments, run Drush remotely, tail logs (ACE only) |
| `ssh-key-management` | Add, list, and delete SSH keys |
| `codestudio` | Set up Code Studio (GitLab CI/CD) projects (ACE only) |
| `scripting` | Run acli non-interactively in scripts and CI/CD |
| `troubleshooting` | Debug acli errors and authentication failures |

#### MEO (Multi-site Enterprise Operations) — `acli api:v3:*`

| Skill | Description |
|-------|-------------|
| `meo-overview` | ACE vs MEO distinction, resource model, authentication, dynamic command discovery |
| `meo-sites` | List, create, update, duplicate, recover, and delete MEO sites |
| `meo-codebases` | Manage codebases, git references, and domain patterns |
| `meo-environments` | Environment details, protection mode, cache clearing, site instance creation, deployments |
| `meo-site-instances` | Site instance lifecycle, domains, databases, backups, wipe |
| `meo-deployments` | Monitor, stop, and terminate MEO deployments |
| `meo-cdn-security` | CDN domains, security rulesets, IP rules, custom rules, rate limiting, failover groups |
| `meo-identity-access` | SSO domains, identity providers, and SSO policies for federated authentication |

### `pipelines-cli` — Acquia Pipelines CLI

| Skill | Description |
|-------|-------------|
| `getting-started` | Install and authenticate the Pipelines CLI |
| `application-management` | Find application IDs and link repos |
| `pipeline-operations` | Trigger builds, check status, stream logs, terminate jobs |

### `drupal-maintenance` — Drupal Dependency Management

| Skill | Description |
|-------|-------------|
| `security-updates` | Audit and fix vulnerable packages using Composer |
| `dependency-updates` | Update outdated packages, Drupal core, and contrib modules |

### `playbooks` — End-to-End Workflows

| Skill | Description |
|-------|-------------|
| `drupal-update-deploy` | Update Drupal dependencies, push code, deploy to environment, and optionally trigger a pipeline |

## Installation

See [docs/tool-integration.md](docs/tool-integration.md) for tool-specific installation instructions (Claude Code, GitHub Copilot, Cursor, Gemini CLI, and more).

## Validation

Before publishing new or updated skills, run:

```bash
python3 scripts/validate_manifests.py
```

To auto-fix a `name` field that doesn't match its directory name:

```bash
python3 scripts/validate_manifests.py --fix
```

The script checks every `SKILL.md` against the [agentskills.io spec](https://agentskills.io/specification) and validates all entries in `manifests/skills-index.yaml`.

### Adding a new skill

1. Create a directory under `skills/<product>/<skill-name>/`
2. Add a `SKILL.md` with `name` matching the directory name
3. Add an entry to `manifests/skills-index.yaml`
4. Run `python3 scripts/validate_manifests.py` — fix any errors before publishing
