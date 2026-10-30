---
name: trial-management
description: "Use when a user wants a free Acquia trial site: creating one, checking provisioning status, retrying a failed trial, or getting the live site URL / admin sign-in link."
license: Proprietary
compatibility: acli>=4.3
metadata:
    category: onboarding
    author: Acquia
    version: "1.1.0"
    tags: "acli, acquia-cloud, trials, provisioning, drupal, onboarding"
    software_requirements: "acli>=4.3"
---

# Trial Site Management

Trials use the v2 Cloud API (`acli api:*`), not MEO (`api:v3:*`). **One trial per account, ever** — a second create is rejected.

## Rules

Follow these at every step:

1. **Stop early, not late.** If a step fails in a way this skill marks as "stop", tell the user why and end the flow. Don't continue to later steps.
2. **Call `api:trials:create` at most once.** Never retry it. The only retry is `api:trials:retry`, and only when `status` is `failed`.
3. **Templates and regions are closed lists.** Offer only ids returned by the list commands. No "Other" option. Never send a value that isn't in the list, even if the user asks.
4. **Don't change telemetry for the user.** Never run `telemetry:disable`.
5. **Don't open or fetch `_links.admin.href`.** Give it to the user.

## Procedure

### 1. Pre-flight

Check all of these before running install or sign-in. Tell the user about any that fail.

- **Shell and network access.** If you can't run commands or reach the network (e.g. a chat-only mode, or sandbox networking disabled by an admin), **stop**: tell the user to switch to a terminal-capable agent such as Claude Code or Claude Cowork, or to sign up in the browser. Don't retry.
- **Reachable hosts** (the user or an admin may need to allow these):
  - `github.com`, `release-assets.githubusercontent.com` (acli download)
  - `id.acquia.com` (sign-in)
  - `cloud.acquia.com` (Cloud API)
- **Eligible identity.** The user must sign in with an identity that has never had a trial. A work email already in an Acquia organization is rejected at create time.

### 2. Install acli 4.3+

Run `acli --version`. If acli is missing, or `acli list api:trials` shows no commands (older than 4.3), install it per [Getting Started → Installation](../getting-started/SKILL.md#installation). Don't install Homebrew or PHP, and don't use `sudo`.

### 3. Sign in

Run this in the background so you can read its output while it waits:

```bash
yes | acli auth:login
```

`yes |` answers acli's prompts: the telemetry question (yes is the default) and, if an API key is already stored, "Sign in with device code instead?". Without it, `--no-interaction` picks the default `no` for that second question and exits with an error.

acli prints `https://id.acquia.com/activate` and an activation code. Tell the user:

> Open https://id.acquia.com/activate, sign in, and enter code `<CODE>`. This links this terminal to your Acquia account. Please do it now — the code expires in 10 minutes. Come back here when the page says the device is activated.

The command blocks until the user approves. That's not a hang.

- If the activate page shows an error for a valid code, ask the user to enter it once more.
- If acli exits with `Code expired.` or `Authorization denied.`, run step 3 again.

### 4. Check identity and eligibility

Do this **before** asking about a site name, template, or region.

```bash
acli api:accounts:find      # which identity acli is using
acli api:account:find-trial # that identity's trial
```

- If the email from `api:accounts:find` isn't the account the user just signed in with, acli is using other stored credentials. Go back to step 3. Don't report anything from `find-trial` yet.
- If `find-trial` returns **404**, the user has no trial. Continue to step 5.
- If it returns a trial, **stop** and tell the user based on its state:

| `find-trial` shows | Tell the user |
|---|---|
| `status: completed` | Their trial exists. Give `_links.site.href` and `_links.admin.href`. |
| `status: failed` | It failed. Offer to retry: `acli api:trials:retry <id>`, then go to step 7. |
| `status: pending` with empty `site_name` or `region` | It's stuck from an earlier failed attempt, and a new trial can't be created on this account. Point them to Acquia support or sales. Don't create or retry. |
| `status: pending` / `in-progress` otherwise | It's still provisioning. Go to step 7. |

### 5. Choose site name, template, and region

**Site name:** must match `^[a-z][a-z0-9]*$`, max 60 characters (lowercase letters and digits, starting with a letter). If the user's name doesn't fit, propose a fixed version (e.g. `My-Site` → `mysite`) and confirm it.

**Template:**

```bash
acli api:trials:list-templates
```

Each item has `id` (pass to create), `name`, `description`, and `tags`. The output is paginated (`--limit`, `--offset`), so fetch every page.

- Show **all** templates as one numbered list in your message, each with `name` and a short description. Don't use a picker that can't show them all.
- Mark one as recommended: the best match for the user's description of their site, or the blank starter template if they gave none.
- Wait for the user to choose.

**Region:**

```bash
acli api:trials:list-regions
```

Each item has `id` (pass to create) and `name`.

- One region: use it without asking, and tell the user ("Your site will be in US East (N. Virginia).").
- Several regions: show them as a numbered list and wait for the user to choose.

### 6. Create

```bash
acli api:trials:create <site_name> <template_id> <region_id>
# e.g. acli api:trials:create mysite umami us-east-1
```

Success prints JSON with `"message": "Trial provisioning has been initiated."`. Don't use `--task-wait` (there's no task to wait on).

If it fails, see [Errors](#errors). Don't call create again.

### 7. Poll

```bash
acli api:account:find-trial
```

Run it every ~10 seconds until `status` is `completed` or `failed`. While pending, report `percent_complete` (0–100).

- For the first ~40 seconds after create, an empty response or 404 means **still pending**, not failure.
- If it's still not `completed` after 10 minutes, stop polling and tell the user the trial is still provisioning.
- `failed`: offer `acli api:trials:retry <id>` (the trial's `id` field), then keep polling.

### 8. Hand over

When `status` is `completed`:

- **Site:** `_links.site.href`. This is the trial's dev environment URL. Staging and prod environments exist too, but this is the site to open.
- **Admin:** `_links.admin.href`. Signs the user into Drupal admin through their Acquia ID, with no separate password. The user opens it in the browser where they're signed in to Acquia.

## Errors

| Error | Meaning | Do |
|---|---|---|
| `400` on create | Bad `site_name`, or a template/region not from the lists. Nothing was created. | Fix the value and call create once more. |
| `409` on create | The account already has a trial. | Run `find-trial` and follow the table in step 4. |
| `already associated with an Acquia organization` on create | This identity isn't eligible. | **Stop.** The user can `acli auth:logout` and repeat from step 3 with a personal identity that has never had a trial. |
| `409` on retry | The trial isn't `failed`. | Run `find-trial` and follow step 4. |
| `Deprecated: ...` lines before JSON | PHP 8.5 warnings from the PHAR build. | See [Troubleshooting](../troubleshooting/SKILL.md#deprecated-warnings-break-json-output). |

There's no CLI command to get a trial by id. Always use `api:account:find-trial`.

## Work on the Trial Locally

Only if the user asks for a local copy (e.g. with DDEV):

1. **SSH key:** upload an RSA key; see [SSH Key Management](../ssh-key-management/SKILL.md#key-requirements). Wait until the git host accepts the key before cloning (it can take several minutes).
2. **PHP:** match `require.php` from the codebase's `composer.json`, e.g. `ddev config --php-version=8.4`. DDEV's default may be lower.
3. **Database:** `acli pull:database --no-import`, then `ddev import-db --file=<downloaded .sql.gz>`.
4. **Files:** can't be pulled from a trial (its SSH allows Drush only). Use `--no-files`; the local site will have no uploaded images.
5. A DDEV `mkcert` warning is harmless.

## Related

- [Getting Started](../getting-started/SKILL.md): install and authentication details
- [SSH Key Management](../ssh-key-management/SKILL.md), [Pull & Push](../pull-push/SKILL.md): local setup
