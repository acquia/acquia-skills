---
name: drupal-update-deploy
description: "Use when user wants to update Drupal dependencies and deploy the changes to an Acquia environment, optionally triggering a pipeline build. Chains drupal-maintenance, acli, and pipelines-cli skills."
license: Proprietary
compatibility: composer>=2.x, acli>=2.x, pipelines-cli>=1.x
metadata:
    category: workflow
    author: Acquia
    version: "1.0.0"
    tags: "drupal, composer, acli, pipelines-cli, deployment, workflow"
    software_requirements: "composer>=2.x, acli>=2.x, pipelines-cli>=1.x"
---

# Drupal Update and Deploy Workflow

Use when:
- Applying Drupal dependency updates and deploying to an Acquia environment
- Running the full cycle: update packages → push code → deploy → trigger pipeline

> **Prerequisites:** The following skill sets must be loaded: `drupal-maintenance`, `acli`, `pipelines-cli`.

---

## Workflow

### Step 1 — Apply dependency updates

Ask the user: **"Do you need to apply dependency updates first, or are updates already done?"**

- If updates are needed → follow **[Security Updates](../../drupal-maintenance/security-updates/SKILL.md)** or **[Dependency Updates](../../drupal-maintenance/dependency-updates/SKILL.md)** depending on the use case, then return here.
- If updates are already applied → proceed to Step 2.

---

### Step 2 — Fetch application and environments

Always run these before asking the user where to deploy. This ensures the correct application and environment IDs are used.

> **This playbook uses ACE (V2) commands.** On a **MEO (V3)** subscription, substitute the V3 equivalents throughout (see [MEO Overview](../../acli/meo-overview/SKILL.md)):
> - `api:applications:list` → `acli api:v3:codebases:list` / `acli api:v3:sites:list`
> - `api:environments:list <app-uuid>` → `acli api:v3:codebases:list-environments <codebaseId>`
> - `api:environments:switchCode` (Step 5) → `acli api:v3:environments:create-deployment <environmentId> true <code_reference>`

```bash
# List available applications and note the UUID
acli api:applications:list
```

Output shows application names and UUIDs. Ask the user: **"Which application do you want to deploy to?"** and confirm the UUID.

```bash
# List environments for the selected application
acli api:environments:list <app-uuid>
```

Output shows environment labels (dev, stage, prod, CDEs), IDs, and the currently deployed branch. Ask the user: **"Which environment do you want to deploy to?"**

---

### Step 3 — Commit code changes

Before pushing, check for uncommitted changes:

```bash
git status
```

If there are uncommitted changes, ask the user: **"Do you want to commit these changes before deploying?"**

- If yes — ask for a commit message, then commit:
  ```bash
  git add -A
  git commit -m "<user-provided message>"
  ```
- If no — warn the user that uncommitted changes will not be included in the deployment and confirm they want to proceed.

---

### Step 4 — Push code to Acquia Cloud

Push the committed code to the selected environment:

```bash
acli push:code
```

Follow **[Pull & Push](../../acli/pull-push/SKILL.md)** for full options (selecting environments, handling conflicts).

---

### Step 5 — Switch code on the environment

After pushing, switch the environment to the updated branch using the environment ID from Step 2:

```bash
acli api:environments:switchCode <environment-id> --branch=<branch-name>
```

Follow **[Environment Management](../../acli/environment-management/SKILL.md)** for deploy options.

---

### Step 6 — Trigger a pipeline build (optional)

Ask the user: **"Do you want to trigger a pipeline build for the deployed branch?"**

- If yes → follow **[Pipeline Operations](../../pipelines-cli/pipeline-operations/SKILL.md)** to start the build and stream logs:

```bash
pipelines start --application-id=<app-id> --vcs-path=<branch> --tail
```

- If no → workflow complete.

---

### Step 7 — Run database updates

After code is live on the environment (and after any pipeline completes), run database updates and rebuild the cache via Drush:

```bash
# SSH into the environment
acli ssh <environment-id>

# Apply pending database updates
drush updb --yes

# Rebuild caches
drush cr
```

> **If using pipelines:** Drush commands may already be included in your pipeline definition. Ask the user: **"Does your pipeline run `drush updb` and `drush cr`?"**
> - If yes → skip this step.
> - If no → run the commands above.

Verify Drush can reach the site and the database schema is up to date:

```bash
drush status
```

Expected output includes `Drupal bootstrap: Successful` and a Drupal version. If Drush fails to bootstrap, do not proceed — check for errors before marking the deployment complete.

---

### Step 8 — Verify deployment

After the pipeline completes (or if skipping pipelines), confirm the environment is running the expected code:

```bash
acli api:environments:list <app-uuid>
```

Check the `vcs` field of the target environment to confirm the branch matches.

---

## Quick Reference

| Step | Tool | Skill |
|------|------|-------|
| Update packages | composer | `drupal-maintenance-security-updates` or `drupal-maintenance-dependency-updates` |
| Fetch application + environments | acli | `acli-application-management`, `acli-environment-management` |
| Commit code changes | git | — |
| Push code | acli | `acli-pull-push` |
| Deploy to environment | acli | `acli-environment-management` |
| Trigger pipeline | pipelines-cli | `pipelines-cli-pipeline-operations` |
| Run database updates | drush | `drush updb`, `drush cr` |
