---
name: remote-access
description: "Use when SSHing into a Cloud environment, running Drush commands remotely, or tailing live application logs."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: authentication
    platform: "ACE (Acquia Cloud Enterprise)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, ssh, drush, logs, remote"
    software_requirements: "acli>=2.x"
---

# Remote Access with Acquia CLI

> **Platform:** This skill applies to **ACE (Acquia Cloud Enterprise)** subscriptions only.
> For MEO (Multi-site Enterprise Operations), see [MEO Overview](../meo-overview/SKILL.md).

Use when:
- Opening an SSH shell on a Cloud environment
- Running a Drush command on a remote environment
- Downloading or listing Drush aliases
- Tailing live logs from an environment

---

## SSH into a Cloud Environment

Open an interactive shell in a Cloud Platform environment:

```bash
acli remote:ssh <alias>
```

Alias: `acli ssh`

The alias format is `app-name.env` (e.g. `myapp.prod`, `myapp.dev`).

```bash
# Open interactive shell
acli remote:ssh myapp.prod

# Run a single command without opening a shell
acli remote:ssh myapp.prod -- ls -la /var/www/html

# Run multiple commands
acli remote:ssh myapp.prod -- "cd /var/www/html && git log --oneline -5"
```

---

## Run Drush Remotely

Run any Drush command on a Cloud environment without SSHing in manually:

```bash
acli remote:drush <drush_command>
```

Aliases: `acli drush`, `acli dr`

```bash
# Check Drupal status
acli remote:drush status

# Clear caches
acli remote:drush cr

# Run database updates
acli remote:drush updatedb

# Export configuration
acli remote:drush cex
```

---

## Tail Logs Live

Stream live logs from an environment:

```bash
acli app:log:tail
```

Aliases: `acli tail`, `acli log:tail`

Prompts you to select the application, environment, and log type.

---

## List Drush Aliases

List all Drush site aliases for your Cloud environments:

```bash
acli remote:aliases:list
```

Aliases: `acli aliases`, `acli sa`

---

## Download Drush Aliases

Download Drush aliases for use with local Drush:

```bash
acli remote:aliases:download
```

Options:

```bash
acli remote:aliases:download \
  --destination-dir=/path/to/aliases \
  --all                               # download aliases for all applications
```

---

## Best Practices

1. **Use `remote:drush` over SSH for Drush commands** — It handles authentication and environment selection automatically.
2. **Use aliases** — Download aliases with `remote:aliases:download` so local Drush can target Cloud environments directly.
3. **Tail logs during deploys** — Run `acli app:log:tail` while deploying to catch errors in real time.

---

## Related Topics

- **[Pull & Push](../pull-push/SKILL.md)** — Sync code, files, and databases
- **[SSH Key Management](../ssh-key-management/SKILL.md)** — Secure access setup
- **[Environment Management](../environment-management/SKILL.md)** — Manage environments
