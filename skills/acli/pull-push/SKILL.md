---
name: pull-push
description: "Use when syncing code, database, or files between local and Acquia Cloud environments, or pulling a Cloud database/files locally."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    platform: "ACE (Acquia Cloud Enterprise)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, sync, deployment, database, files"
    software_requirements: "acli>=2.x"
---

# Pull & Push with Acquia CLI

> **Platform:** This skill applies to **ACE (Acquia Cloud Enterprise)** subscriptions only.
> For MEO (Multi-site Enterprise Operations), see [MEO Site Instances](../meo-site-instances/SKILL.md) for database and file operations.

Use when:
- Syncing your local environment with a Cloud Platform environment
- Pulling code, database, or files from Cloud to local
- Pushing code, database, files, or build artifacts to Cloud

---

## Pull: Copy from Cloud to Local

### Pull everything (code + database + files)

```bash
acli pull:all
```

Aliases: `acli refresh`, `acli pull`

Prompts you to select an environment, then copies code, database, and files to your local environment.

**Options:**

```bash
acli pull:all \
  --dir=/path/to/project \
  --no-code \        # skip code
  --no-databases \   # skip database
  --no-files \       # skip files
  --no-scripts       # skip post-pull scripts
```

---

### Pull code only

```bash
acli pull:code
```

Pulls the latest code from the selected Cloud environment into your local directory.

```bash
acli pull:code --dir=/path/to/project
```

---

### Pull database only

```bash
acli pull:database
```

Alias: `acli pull:db`

Imports a database backup from a Cloud environment into your local database.

**Options:**

```bash
acli pull:database \
  --on-demand \      # force a fresh on-demand backup (not cached)
  --no-import \      # download the backup file but don't import it
  --multiple-dbs     # download multiple databases (multisite)
```

---

### Pull files only

```bash
acli pull:files
```

Copies Drupal public files (`sites/default/files`) from the Cloud environment to your local.

---

### Run post-pull scripts manually

If you skipped scripts during a pull, run them separately:

```bash
acli pull:run-scripts
acli pull:run-scripts --dir=/path/to/project
```

---

## Push: Copy from Local to Cloud

### Push database

```bash
acli push:database
```

Alias: `acli push:db`

Uploads your local database to a Cloud Platform environment. Requires both a local and remote database to be configured.

---

### Push files

```bash
acli push:files
```

Copies your local Drupal public files to the selected Cloud environment.

---

### Push code (IDE only)

```bash
acli push:code
```

Push code from your Cloud IDE to a Cloud Platform environment. This command is only available inside a Cloud IDE or Lando environment.

---

### Build and push a code artifact

Build your project and push the compiled artifact to a Cloud environment or custom git remote:

```bash
acli push:artifact
```

**Common options:**

```bash
# Push to a specific branch on Cloud
acli push:artifact --destination-git-branch=deploy/main

# Push to a specific tag
acli push:artifact --destination-git-tag=release-1.2.3

# Push to an external git URL (e.g. GitHub)
acli push:artifact --destination-git-urls=git@github.com:myorg/myrepo.git

# Dry run — build but don't push
acli push:artifact --no-push

# Build in a specific directory
acli push:artifact --dir=/path/to/project

# Skip sanitization step
acli push:artifact --no-sanitize
```

---

## Typical Workflows

### Refresh local dev environment

```bash
acli pull:all
```

### Pull only the database (fastest for testing)

```bash
acli pull:database --on-demand
```

### Deploy a build artifact to Cloud

```bash
acli push:artifact --destination-git-branch=tags/deploy-branch
```

### Sync files to production (use with care)

```bash
acli push:files
```

---

## Best Practices

1. **Always pull before you push** — Avoid overwriting recent Cloud changes.
2. **Use `--on-demand` for fresh data** — The default pull uses a cached backup; `--on-demand` forces a new one.
3. **Test artifact builds with `--no-push`** — Verify the artifact is correct before pushing.
4. **Use `--no-scripts` in CI** — Post-pull scripts are designed for local dev, not CI pipelines.
5. **Backup before pushing a database** — A push:database overwrites the remote database.

---

## Troubleshooting

### "Local database not found"

`pull:all` and `pull:database` require a running local database. Make sure your local Drupal stack (Lando, DDEV, etc.) is running.

### "Access denied" on push

Verify your SSH key is set up and your account has write access to the environment:

```bash
acli ssh-key:list
acli auth:me
```

### Artifact push fails

Check that `composer install` and any build steps complete without errors before pushing:

```bash
acli push:artifact --no-push  # dry run to inspect
```

---

## Related Topics

- **[Application Management](../application-management/SKILL.md)** — Find environment IDs
- **[SSH Key Management](../ssh-key-management/SKILL.md)** — Authentication
- **[Remote Access](../remote-access/SKILL.md)** — SSH and Drush on Cloud environments
