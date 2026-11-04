---
name: trial-management
description: "Use when creating a trial Acquia Cloud site, checking trial provisioning status, retrying a failed trial, or finding the live URL / admin sign-in link for a trial site."
license: Proprietary
compatibility: acli>=4.3
metadata:
    category: onboarding
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, trials, provisioning, drupal, onboarding"
    software_requirements: "acli>=4.3"
---

# Trial Site Management

Use when:
- Creating a new trial Drupal site on Acquia Cloud
- Checking whether a trial is still provisioning, has finished, or has failed
- Getting the live site URL or admin sign-in link for a completed trial
- Retrying a trial that failed to provision

Trials use the v2 Cloud API (`acli api:*`), not MEO (`api:v3:*`). **One trial per account, ever** — a second create is rejected.

## Rules

Follow these at every step:

1. **Stop early, not late.** If a step fails in a way this skill marks as "stop", tell the user why and end the flow. Don't continue to later steps.
2. **Call `api:trials:create` once per signed-in identity.** The only exception: after a `400`, nothing was created, so fix the value and call it once more. Any other failure: report it and stop. To recover a trial whose `status` is `failed`, use `api:trials:retry`, never create.
3. **Templates and regions are closed lists.** Offer only ids returned by the list commands. No "Other" option. Never send a value that isn't in the list, even if the user asks.
4. **Three questions, as options.** The whole flow asks the user three questions: Q1 before installing (step 1), Q2 before creating (step 5), Q3 after hand-over (step 8). Ask nothing else unless a step says so. Use your harness's multiple-choice question tool if it has one, recommended option first; otherwise a numbered list answerable by number. Never ask the user to type a value, except a new site name when they choose to change it.
5. **Telemetry is the user's choice, asked in Q1.** Export `ACLI_NO_TELEMETRY=true` for every command, so acli never asks or records a default for the user, and record the Q1 answer with `acli self:telemetry:enable -n` or `acli self:telemetry:disable -n` (see [Getting Started → Telemetry](../getting-started/SKILL.md#telemetry)).
6. **Don't open or fetch `_links.admin.href`.** Give it to the user.

## Procedure

### 1. Pre-flight

Check all of these before running install or sign-in. Tell the user about any that fail.

- **Shell and network access.** If you can't run commands or reach the network (e.g. a chat-only mode, or sandbox networking disabled by an admin), **stop**: tell the user to switch to an agent or mode that can run terminal commands, or to sign up in the browser. Don't retry.
- **Reachable hosts** (the user or an admin may need to allow these):
  - `github.com`, `release-assets.githubusercontent.com` (acli download)
  - `id.acquia.com` (sign-in)
  - `cloud.acquia.com` (Cloud API)
- **Eligible identity.** The user must sign in with an identity that has never had a trial. A work email already in an Acquia organization is rejected at create time.

Then ask **Q1**, one question whose text gives the plan (install acli, one browser sign-in, one proposal to approve) and the eligible-identity rule above. Options:

1. **Go ahead (Recommended):** install acli (and Acquia Skills, if not installed), usage data off.
2. **Go ahead and share usage data:** the same, with acli telemetry on.
3. **Use the browser instead:** give https://www.acquia.com/products/acquia-cloud-platform/trial and end the flow.

Q1 is the consent for every install in the flow. Don't ask again in step 2.

### 2. Install acli 4.3+

Run `acli --version`. If acli is missing, or `acli list api:trials` shows no commands (older than 4.3), install it per [Getting Started → Installation](../getting-started/SKILL.md#installation). Don't install Homebrew or PHP, and don't use `sudo`.

### 3. Sign in

Run this in the background so you can read its output while it waits. Don't pass `-n`: with credentials stored, it takes the default `no` to the device-code prompt and falls through to an API key prompt.

```bash
export ACLI_NO_TELEMETRY=true      # Rule 5: no telemetry prompt can take the piped answer
SHELL_INTERACTIVE=1 acli auth:login
```

`SHELL_INTERACTIVE=1` makes acli treat the session as interactive even though an agent's shell has no terminal, so a piped answer reaches its prompt. Read the first line of output:

- `Already authenticated as <label> (API key)`: re-run as `printf 'y\n' | SHELL_INTERACTIVE=1 acli auth:login` to answer yes to `Sign in with device code instead?`. The stored key stays on disk, untouched.
- `Already authenticated via device code`: run `acli api:accounts:find`. If it succeeds, go to step 4. If it reports `Device token session expired`, re-run as `printf 'y\n' | SHELL_INTERACTIVE=1 acli auth:login` to answer yes to `Re-authenticate?`.
- Otherwise it prints the activation URL and code and waits.

Pipe exactly one `y` (`printf 'y\n'`). Never pipe `yes`, the endless form: if device code fails, it also answers the API key fallback prompts and loops forever on `Value "y" is invalid`.

acli prints `https://id.acquia.com/activate` and an activation code. Tell the user:

> Open https://id.acquia.com/activate, sign in, and enter code `<CODE>`. This links this terminal to your Acquia account. Please do it now — the code expires in 10 minutes. Come back here when the page says the device is activated.

The command blocks until the user approves. That's not a hang.

- If the activate page shows an error for a valid code, ask the user to enter it once more.
- If acli exits with `Code expired.` or `Authorization denied.`, run step 3 again.

The activate page also asks the user to accept the trial agreement and acceptable use policy. That click signs them in and records their acceptance of the terms. It is **not** approval to create a specific trial (see step 5). If the user declines the terms, relay the result and don't create a trial. An existing password-based Acquia ID can't sign in with Google; the page says to use username and password. Relay that and don't retry Google. For other sign-in failures see [Troubleshooting](../troubleshooting/SKILL.md#device-code-sign-in-fails).

Only if the user wants to use an existing API key and secret instead of device code: `acli auth:login --use-legacy-auth` (or pass `--key`/`--secret`). See [Getting Started](../getting-started/SKILL.md).

### 4. Check identity and eligibility

Do this **before** asking about a site name, template, or region.

```bash
acli api:accounts:find      # which identity acli is using
acli api:account:find-trial # that identity's trial
```

Keep the email from `api:accounts:find`. Don't ask whether it's the right account here: Q2 shows it and offers a different account.

- If `find-trial` returns **404**, the user has no trial. Continue to step 5.
- Otherwise act on its state. A trial lasts 14 days from `created_at`; the response has no expiry field and `status` stays `completed` after expiry, so compute expiry as `created_at` + 14 days against `date -u`.

| `find-trial` shows | Do |
|---|---|
| `status: pending` / `in-progress` and any of: empty `site_name`, empty `region`, `created_at` more than 1 hour ago | **Stop.** It's stuck from an earlier failed attempt, and a new trial can't be created on this account. Give the trial `id` and point them to [Acquia Support](https://acquia.my.site.com/s/contactsupport). Don't create or retry (`api:trials:retry` is for `failed` trials only). |
| `status: pending` / `in-progress` otherwise | Still provisioning. Go to step 7. |
| `status: completed`, expiry in the future | Active. Don't create. Go to step 8 and add the expiry date to the hand-over. |
| `status: completed`, expiry passed | **Stop.** The trial ended on that date and each account gets one. Point them to [Acquia](https://www.acquia.com/about-us/contact) or their account manager. |
| `status: failed` | Run `acli api:trials:retry <id>` once, then go to step 7. |

### 5. Choose site name, template, and region

**Site name:** must match `^[a-z][a-z0-9]*$`, max 60 characters (lowercase letters and digits, starting with a letter). Make one up from what the user described.

**Template:**

```bash
acli api:trials:list-templates
```

Each item has `id` (pass to create), `name`, `description`, and `tags`. The output is paginated (`--limit`, `--offset`), so fetch every page.

Pick one: the best match for the user's description of their site, or the blank starter template (`drupal_cms_site_template_base`) if they gave none.

**Region:**

```bash
acli api:trials:list-regions
```

Each item has `id` (pass to create) and `name`.

- One region: use it without asking, and name it in Q2.
- Several regions: pick the nearest to any location the user mentioned, and add a `Choose a different region` option to Q2.

**Q2: confirm in one question.** Check all three values against the lists and the name pattern. Then ask: "Signed in as `<email>`. Ready to create `<site_name>` with the `<template name>` template in `<region name>`." Options:

1. **Create it (Recommended).**
2. **Choose a different template:** follow up with every template `name` as an option, recommended first. If your question tool can't show them all, use a numbered list; never drop one.
3. **Change the site name:** the one free-text answer. Fix a name that breaks the pattern (e.g. `My-Site` → `mysite`) and say so; no second confirmation.
4. **Use a different account:** `printf 'y\n' | SHELL_INTERACTIVE=1 acli auth:login` to answer yes to `Re-authenticate?`, then continue from the activation message in step 3.

"Use defaults", or values the user already gave, answer Q2. This is required even though the user already signed in: creating a trial acts on their real account and is approved separately from authenticating.

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

- For the first 2 minutes after create, an empty response or 404 means **still pending**, not failure. A 404 after that means create didn't take: stop and tell the user.
- If it's still not `completed` after 10 minutes, stop polling and tell the user the trial is still provisioning.
- `failed`: offer `acli api:trials:retry <id>`. Use the trial's `id` field (it's also in `_links.retry.href`). Then keep polling. Retry **once** only; if it fails again, relay the failure reason to the user instead of retrying further.

### 8. Hand over

When `status` is `completed`:

- **Site:** `_links.site.href`. This is the trial's dev environment URL. Staging and prod environments exist too, but this is the site to open.
- **Admin:** `_links.admin.href`. A one-time, expiring link that signs the user into the Drupal admin with no separate password. The user opens it in their browser. Report it verbatim and never fetch, open, or test it yourself.
- **`_links.self` is not the site.** It's the trial's API record URL. Don't give it to the user as the site link.
- Both links exist only when `status` is `completed`. While pending, report `percent_complete` and keep polling.

Then ask **Q3**, "What next?", with options: **Open the site** (you open nothing), **Work on it locally** (say that it uploads an SSH key and sets up DDEV; choosing it is the consent for both), **Start building**, **Done**.

## Errors

| Error | Meaning | Do |
|---|---|---|
| `400` on create | Bad `site_name`, or a template/region not from the lists. Nothing was created. | Fix the value, tell the user what changed, and call create once more. |
| `409` on create | The account already has a trial. | Run `find-trial` and follow the table in step 4. |
| `403` / `already associated with an Acquia organization` on create | This identity isn't eligible. | **Stop**, asking with two options: **Sign in with a different account** (Q2 option 4, then repeat from step 4) or **Use the browser instead**. Don't retry create or re-run `auth:login` on your own. |
| `409` on retry | The trial isn't `failed`. | Run `find-trial` and follow step 4. |
| `Deprecated: ...` lines before JSON | PHP 8.5 warnings from the PHAR build. | See [Troubleshooting](../troubleshooting/SKILL.md#deprecated-warnings-break-json-output). |

There's no CLI command to get a trial by id. Always use `api:account:find-trial`.

## Work on the Trial Locally

Trial SSH is stricter than a regular Cloud environment: **Drush over SSH only**. Interactive shells, rsync, scp, and sftp are rejected. That's expected, not an error to retry. Don't test an SSH key with plain `ssh` against the trial; use it for `git clone` only.

Only if the user asks for a local copy (e.g. with DDEV):

1. **SSH key:** upload an RSA key with `--no-wait -n` (the trial directory has no linked application); see [SSH Key Management](../ssh-key-management/SKILL.md#key-requirements). Wait until the git host accepts the key before cloning (it can take several minutes).
2. **PHP:** match `require.php` from the codebase's `composer.json`, e.g. `ddev config --php-version=8.4`. DDEV's default may be lower.
3. **Database:** `acli pull:database --no-import`, then `ddev import-db --file=<downloaded .sql.gz>`.
4. **Files:** can't be pulled from a trial (its SSH allows Drush only). Use `--no-files`; the local site will have no uploaded images.
5. A DDEV `mkcert` warning is harmless.

## Related

- [Getting Started](../getting-started/SKILL.md): install and authentication details
- [SSH Key Management](../ssh-key-management/SKILL.md), [Pull & Push](../pull-push/SKILL.md): local setup
- [MEO Overview](../meo-overview/SKILL.md): for sites that later move to a full MEO/ACE subscription
