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

Trials use the v2 Cloud API (`acli api:*`), not MEO (`api:v3:*`). **One trial per account, ever**: a second create is rejected.

## Taking a user through a trial

To start a trial for a user end to end, fetch and follow the runbook:

**https://dev.acquia.com/agents/cloud-platform-trial.md**

It holds the order of the steps, the three questions to ask the user (and their exact wording), and the message for every point where the flow stops. This skill is the command reference behind it: what each command does, what its output means, and why each workaround exists. Where the two differ on order, questions or what to tell the user, follow the runbook.

If you cannot fetch it, keep to its shape: one question before you install anything (covering installs and usage data), one before you create the trial (site name, template, region and the signed-in account), and one after hand-over. Ask each as options, recommended first.

## Rules

1. **Call `api:trials:create` once per signed-in identity.** The only exception: after a `400`, nothing was created, so fix the value and call it once more. To recover a trial whose `status` is `failed`, use `api:trials:retry`, never create.
2. **Templates and regions are closed lists.** Send only ids returned by the list commands, even if the user asks for another value.
3. **Telemetry is the user's choice.** Export `ACLI_NO_TELEMETRY=true` for every command, so acli never asks or records a default for the user. Record the user's answer with `acli self:telemetry:enable -n` or `acli self:telemetry:disable -n`. See [Getting Started → Telemetry](../getting-started/SKILL.md#telemetry).
4. **Don't open or fetch `_links.admin.href`.** It signs the holder into the site. Give it to the user.

## Commands

### Install acli 4.3+

A copy is usable when `acli --version` prints `Acquia CLI` 4.3 or later and `acli list api:trials` lists the trial commands. Check `~/.local/bin/acli` before the PATH: an old copy can come first. To install, see [Getting Started → Installation](../getting-started/SKILL.md#installation). Don't install Homebrew or PHP, and don't use `sudo`.

Hosts the flow needs: `github.com` and `release-assets.githubusercontent.com` (acli download), `registry.npmjs.org` (Acquia Skills), `id.acquia.com` (sign-in), `cloud.acquia.com` (Cloud API).

### Sign in (device code)

```bash
export ACLI_NO_TELEMETRY=true      # Rule 3; also stops a telemetry prompt taking a piped answer
SHELL_INTERACTIVE=1 acli auth:login
```

Run it in the background and read its output while it waits. Why each part:

- **No `-n`.** With credentials stored, acli asks `Sign in with device code instead?` (API key stored) or `Re-authenticate?` (device session stored). `-n` takes the default `no` and falls through to an API key prompt, exiting 1.
- **`SHELL_INTERACTIVE=1`.** acli treats a session whose output is not a terminal (an agent's shell) as non-interactive, so a piped answer would never reach the prompt.
- **One piped `y` to answer a prompt:** `printf 'y\n' | SHELL_INTERACTIVE=1 acli auth:login`. The stored API key stays on disk. Never pipe `yes`, the endless form: if device code fails, it also answers the API key fallback prompts and loops forever on `Value "y" is invalid`.

First line of output:

| Output | Meaning | Do |
|---|---|---|
| `Already authenticated as <label> (API key)` | An older key is stored | Re-run with one piped `y` |
| `Already authenticated via device code` | A session is stored | `acli api:accounts:find`; on `Device token session expired`, re-run with one piped `y` |
| An activation URL and code | Waiting for the user | Give the user both; the command blocks until they approve |

Sign-in results:

- `Code expired.` (after about 10 minutes) or `Authorization denied.`: run sign-in again.
- An error page for a valid code: the user can submit it once more.
- The page says to use username and password: the Acquia ID is password-based, so Google sign-in won't work for it.
- The activation page also records acceptance of the trial agreement and acceptable use policy. That is not approval to create a specific trial.
- To use an existing API key and secret instead: `acli auth:login --use-legacy-auth`.

`acli api:accounts:find` shows which identity acli is using (`mail`).

### Check a trial: `api:account:find-trial`

```bash
acli api:account:find-trial
```

Returns the signed-in identity's trial: `id`, `site_name`, `status`, `created_at`, `updated_at`, `percent_complete` (0–100), `region`, and `_links`. There's no CLI command to get a trial by id.

A trial lasts 14 days from `created_at`. The response has no expiry field and `status` stays `completed` after expiry, so compute expiry as `created_at` + 14 days against `date -u`.

| Shows | Meaning |
|---|---|
| `404`, `This user does not have an active trial account.` | No trial: eligible to create |
| `pending` / `in-progress` with an empty `site_name`, an empty `region`, or `created_at` more than 1 hour ago | Stuck record from an earlier failure. Blocks a new trial; only Acquia Support can clear it. Don't create or retry |
| `pending` / `in-progress` otherwise | Provisioning |
| `completed`, expiry in the future | Active |
| `completed`, expiry passed | Expired; the account can't get another |
| `failed` | Retry once with `acli api:trials:retry <id>` |

### Choose values

- **Site name:** `^[a-z][a-z0-9]*$`, max 60 characters (lowercase letters and digits, starting with a letter). Fix a name that breaks it, e.g. `My-Site` → `mysite`.
- **Templates:** `acli api:trials:list-templates`. Each item has `id` (pass to create), `name`, `description`, `tags`. Paginated (`--limit`, `--offset`): fetch every page. `drupal_cms_site_template_base` is the blank starter.
- **Regions:** `acli api:trials:list-regions`. Each item has `id` (pass to create) and `name`.

### Create

```bash
acli api:trials:create <site_name> <template_id> <region_id>
# e.g. acli api:trials:create mysite umami us-east-1
```

Success prints JSON with `"message": "Trial provisioning has been initiated."`. Don't use `--task-wait`: there's no task to wait on.

### Poll

Run `acli api:account:find-trial` every ~10 seconds until `status` is `completed` or `failed`.

- For 2 minutes after create, an empty response or `404` means still starting. A `404` after that means create didn't take.
- Provisioning normally finishes within 10 minutes.
- `failed`: retry once with the trial's `id` (also in `_links.retry.href`).

### Links on a completed trial

- `_links.site.href`: the site, which is the trial's dev environment. Staging and prod exist with their own domains.
- `_links.admin.href`: a one-time, expiring Drupal admin sign-in link. Rule 4.
- `_links.self`, `organization`, `subscription`: API records, not the site. Some return `404`; use acli commands instead.

Both site and admin links exist only when `status` is `completed`.

## Errors

| Error | Meaning | Do |
|---|---|---|
| `400` on create | Bad `site_name`, or a template/region not from the lists. Nothing was created. | Fix the value and call create once more. |
| `409` on create | The account already has a trial. | Run `find-trial` and act on its state. |
| `403` / `already associated with an Acquia organization` on create | The identity belongs to an Acquia organization and can't take a trial. | Don't retry create. Only a different identity (one that has never had a trial) can. |
| `403` / permission error otherwise | Terms not accepted, or the wrong identity is signed in. | Check `api:accounts:find`, sign in again. |
| `409` on retry | The trial isn't `failed`. | Run `find-trial` and act on its state. |
| `Deprecated: ...` lines before JSON | PHP 8.5 warnings from the PHAR build. | See [Troubleshooting](../troubleshooting/SKILL.md#deprecated-warnings-break-json-output). |

## Work on the Trial Locally

Trial SSH is stricter than a regular Cloud environment: **Drush over SSH only**. Interactive shells, rsync, scp, and sftp are rejected. That's expected, not an error to retry. Use the key for `git clone`, not plain `ssh` to the environment.

1. **SSH key:** RSA only. Upload with `--no-wait -n`: the trial directory has no linked application, and without `--no-wait` acli prints `Could not determine Cloud Application` after the upload worked. See [SSH Key Management](../ssh-key-management/SKILL.md#key-requirements). The git host can take several minutes to accept a new key.
2. **PHP:** match `require.php` from the codebase's `composer.json`, e.g. `ddev config --php-version=8.4`. DDEV's default may be lower.
3. **Database:** `acli pull:database --no-import`, then `ddev import-db --file=<downloaded .sql.gz>`.
4. **Files:** can't be pulled from a trial. Use `--no-files`; the local site will have no uploaded images.
5. A DDEV `mkcert` warning is harmless.

## Related

- [Getting Started](../getting-started/SKILL.md): install and authentication details
- [SSH Key Management](../ssh-key-management/SKILL.md), [Pull & Push](../pull-push/SKILL.md): local setup
- [MEO Overview](../meo-overview/SKILL.md): for sites that later move to a full MEO/ACE subscription
