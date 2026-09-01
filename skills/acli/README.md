# ACLI Skills

Command-line skills for [Acquia CLI (acli)](https://github.com/acquia/cli).

## Skills

### ACE (Acquia Cloud Enterprise) — `acli api:*`

| Skill | Description |
|-------|-------------|
| [getting-started](getting-started/SKILL.md) | Install acli, authenticate, ACSF login, telemetry, cache management |
| [ide-management](ide-management/SKILL.md) | Create, open, share, and manage Cloud IDEs (ACE only) |
| [application-management](application-management/SKILL.md) | List/open apps, create projects, deploy, archive export, app:vcs:info (ACE only) |
| [ssh-key-management](ssh-key-management/SKILL.md) | Create, upload, list, inspect, and delete SSH keys |
| [environment-management](environment-management/SKILL.md) | Create/delete CDEs, mirror environments, crons, SSL certificates (ACE only) |
| [pull-push](pull-push/SKILL.md) | Pull/push code, database, files, and build artifacts (ACE only) |
| [remote-access](remote-access/SKILL.md) | SSH into environments, run remote Drush, download aliases, tail logs (ACE only) |
| [codestudio](codestudio/SKILL.md) | Set up Code Studio, change PHP version (ACE only) |
| [scripting](scripting/SKILL.md) | Use acli non-interactively in scripts and CI/CD pipelines |
| [troubleshooting](troubleshooting/SKILL.md) | Diagnose and fix common acli errors |

### MEO (Multi-site Enterprise Operations) — `acli api:v3:*`

| Skill | Description |
|-------|-------------|
| [meo-overview](meo-overview/SKILL.md) | ACE vs MEO distinction, resource model, authentication, dynamic command discovery |
| [meo-sites](meo-sites/SKILL.md) | List, create, update, duplicate, recover, and delete MEO sites |
| [meo-codebases](meo-codebases/SKILL.md) | Manage codebases, git references, and domain patterns |
| [meo-environments](meo-environments/SKILL.md) | Environment details, protection mode, cache clearing, site instance creation, deployments |
| [meo-site-instances](meo-site-instances/SKILL.md) | Site instance lifecycle, domains, databases, backups, wipe |
| [meo-deployments](meo-deployments/SKILL.md) | Monitor, stop, and terminate MEO deployments |
| [meo-cdn-security](meo-cdn-security/SKILL.md) | CDN domains, security rulesets, IP rules, custom rules, rate limiting, failover groups |
| [meo-identity-access](meo-identity-access/SKILL.md) | SSO domains, identity providers, and SSO policies for federated authentication |
| [meo-translation-layer](meo-translation-layer/SKILL.md) | ACE environment variables, crons, mod-proxy, StackMetrics, and runtimes via the v3 gateway |
