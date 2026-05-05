---
name: application-management
description: "Use when listing Acquia Cloud applications, linking or unlinking a local repo to an application, opening an app in browser, checking VCS/branch deployment status, or exporting a site archive."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: deployment
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, applications, deployment"
    software_requirements: "acli>=2.x"
---

# Managing Applications

Use when:
- Listing applications you have access to
- Linking or unlinking a local repo to a Cloud application
- Creating a new Drupal or Next.js project
- Checking branch/tag deployment status
- Waiting for an async task to complete
- Exporting a full site archive

---

## List Applications

```bash
acli api:applications:list
```

Returns a JSON array of all applications you have access to. Each entry includes `id`, `uuid`, `name`, `type`, `status`, and `organization`.

To display a readable table:

```bash
acli api:applications:list | python3 -c "
import json, sys
apps = json.load(sys.stdin)
for a in apps:
    print(f\"{a['id']:<10} {a['name']:<40} {a.get('type',''):<10} {a.get('status',''):<10}\")
"
```

---

## Open Application in Browser

```bash
acli app:open
```

Aliases: `acli open`, `acli o`

Opens the selected Cloud application in your default browser.

---

## Link and Unlink a Local Repository

Associate your local checkout with a Cloud application so commands like `env:deploy` can detect the app automatically:

```bash
cd /path/to/project
acli app:link
```

To remove the association:

```bash
acli app:unlink
```

---

## Check Branch and Tag Deployment Status

```bash
acli app:vcs:info
```

Lists all branches and tags in the application's git repository along with which environment (if any) each is currently deployed to.

---

## Wait for an Async Task

Some Cloud operations (database copies, environment mirrors) return a notification UUID. Wait for them to complete:

```bash
acli app:task-wait <notification-uuid>
```

Useful in CI/CD pipelines to block until a task finishes before proceeding.

---

## Create a New Local Project

Scaffold a new Drupal or Next.js project from an Acquia-recommended template:

```bash
# Interactive — prompts for template and directory
acli app:new:local

# Non-interactive
acli app:new:local my-project --template=acquia_drupal_recommended
acli app:new:local my-project --template=acquia_drupal_cms
```

Alias: `acli new`

Available templates:
- `acquia_drupal_recommended` — Standard Acquia Drupal project
- `acquia_drupal_cms` — Acquia Drupal CMS project

---

## Migrate from Drupal 7

Generate a new Drupal 9+ project from an existing Drupal 7 application using Acquia Migrate Accelerate:

```bash
acli app:new:from:drupal7
```

Options: `--drupal7-directory`, `--drupal7-uri`, `--stored-analysis`, `--recommendations`, `--directory`

Aliases: `acli ama`, `acli from:d7`

---

## Export a Site Archive

Export an application's code, files, and database as a single archive file:

```bash
acli archive:export /path/to/destination/
```

Options:

```bash
# Exclude public files
acli archive:export /path/to/destination/ --no-files

# Exclude database
acli archive:export /path/to/destination/ --no-database

# Use a specific source directory
acli archive:export /path/to/destination/ --dir=/path/to/drupal
```

---

## Best Practices

1. **Link your repo** — Run `acli app:link` in every project checkout so app-aware commands work without extra flags.
2. **Check VCS status before deploying** — Use `acli app:vcs:info` to confirm the right branch is ready.
3. **Use `app:task-wait` in CI** — Ensures async Cloud operations complete before the next pipeline step runs.

---

## Related Topics

- **[Environment Management](../environment-management/SKILL.md)** — List environments, deploy, create CDEs
- **[Pull & Push](../pull-push/SKILL.md)** — Sync code, database, and files
- **[Remote Access](../remote-access/SKILL.md)** — SSH, Drush, and log tailing
- **[SSH Key Management](../ssh-key-management/SKILL.md)** — Secure access setup
