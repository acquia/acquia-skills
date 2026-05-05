---
name: acsf-content
description: "Use when managing ACSF themes, installation profiles, cron jobs, or viewing page-view analytics on Acquia Cloud Site Factory."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: acsf
    author: Acquia
    version: "1.0.0"
    tags: "acli, acsf, acquia-cloud-site-factory, themes, cron, install-profiles, page-views"
    software_requirements: "acli>=2.x"
---

# ACSF Content and Configuration Management

Use when:
- Managing themes and VCS theme links
- Enabling, disabling, or setting default installation profiles
- Creating, editing, or deleting cron jobs
- Viewing page-view analytics

> **Prerequisites:** Authenticate with ACSF first via `acli auth:acsf-login`. See **[Getting Started](../getting-started/SKILL.md)** for setup.

---

## Themes

### Link a VCS repository to provide themes

```bash
acli acsf:themes:link-vcs \
  --repo-url=git@github.com:myorg/themes.git \
  --branch=main
```

### Refresh themes from VCS

Pull the latest theme code from the linked repository:

```bash
acli acsf:themes:refresh
```

### Manage theme notifications

Configure notifications for theme events (e.g., refresh completion):

```bash
acli acsf:themes:notifications
```

---

## Installation Profiles

Installation profiles define the base configuration for new sites on the factory.

### List available profiles

```bash
acli acsf:install-profiles
```

### Enable a profile

```bash
acli acsf:install-profiles:enable --profile=<profile-name>
```

### Disable a profile

```bash
acli acsf:install-profiles:disable --profile=<profile-name>
```

### Set the default profile

```bash
acli acsf:install-profiles:set-default --profile=<profile-name>
```

The default profile is used automatically when creating new sites without specifying a profile.

---

## Cron Jobs

### Find cron jobs

```bash
acli acsf:cron:find-jobs
```

Returns a list of all configured cron jobs on the factory.

### Get cron job details

```bash
acli acsf:cron:get-job --job-id=<job-id>
```

### Create a cron job

```bash
acli acsf:crons:create \
  --site-id=<site-id> \
  --command="drush cron" \
  --interval="0 * * * *" \
  --label="Hourly Drupal cron"
```

The `--interval` field accepts standard cron expressions.

### Edit a cron job

```bash
acli acsf:crons:edit \
  --job-id=<job-id> \
  --interval="0 2 * * *" \
  --label="Nightly cron"
```

### Delete a cron job

```bash
acli acsf:crons:delete --job-id=<job-id>
```

---

## Page Views

### Get aggregated page views

View factory-wide traffic metrics:

```bash
acli acsf:page-views
```

### Get page views for a specific domain

```bash
acli acsf:page-views --domain=www.example.com
```

Useful for identifying high-traffic sites and capacity planning.

---

## Best Practices

1. **Set a default install profile** — Ensures new sites are consistently provisioned without requiring manual profile selection.
2. **Refresh themes after VCS changes** — Always run `acsf:themes:refresh` after pushing theme updates to VCS.
3. **Review cron jobs after site duplication** — Duplicated sites inherit cron jobs; adjust schedules to avoid thundering-herd issues.
4. **Stagger cron schedules** — Avoid scheduling all sites' cron at the same minute to reduce factory load.

---

## Related Topics

- **[ACSF Site Management](../acsf-site-management/SKILL.md)** — Create and manage sites
- **[ACSF Infrastructure](../acsf-infrastructure/SKILL.md)** — Service status and updates
- **[Getting Started](../getting-started/SKILL.md)** — Authentication setup
