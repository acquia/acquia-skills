---
name: trial-management
description: "Use when creating a trial Acquia Cloud site, checking trial provisioning status, retrying a failed trial, or finding the live URL / admin sign-in link for a trial site."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: onboarding
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, trials, provisioning, drupal, onboarding"
    software_requirements: "acli>=2.x"
---

# Trial Site Management

Use when:
- Creating a new trial Drupal site on Acquia Cloud
- Checking whether a trial is still provisioning, has finished, or has failed
- Getting the **live site URL** or **admin sign-in link** for a completed trial
- Retrying a trial that failed to provision
- Picking a Drupal template or AWS region before creating a trial

**Note:** The Trials API is a lightweight, pre-MEO provisioning surface in the v2 Cloud API (`acli api:*`), not MEO (`acli api:v3:*`). A user can have only **one active trial at a time**.

---

## The Trial Lifecycle

```
api:trials:create ──▶ pending ──▶ in-progress ──▶ completed
                                        │
                                        └────────▶ failed ──▶ api:trials:retry ──▶ in-progress
```

`status` is always one of: `pending`, `in-progress`, `completed`, `failed`. Poll with `api:account:find-trial` — never assume completion, always check `status` before trusting `_links`.

| Status | What's available |
|---|---|
| `pending` / `in-progress` | `percent_complete` (0-100 integer) only. No site link yet. |
| `completed` | `_links.site` (live public URL) and `_links.admin` (one-time sign-in link) both appear. |
| `failed` | `_links.retry` appears. Call `api:trials:retry`, not `api:trials:create` again. |

**Stuck trial:** if `status` is `pending` with `site_name: null`, the trial is stuck server-side and cannot be resumed or retried (`api:trials:retry` is for `failed` trials only). Do not call `api:trials:create` again. Report the trial's `id` to the user and direct them to Acquia Support to clear the record.

---

## Check Your Trial (and get the live site URL)

```bash
acli api:account:find-trial
```

This looks up **your own** trial account — no ID argument needed. This is the command to poll after creating a trial, and the command to use whenever an agent or user asks "where's my site?" / "is my trial ready?".

Example response once provisioning finishes:

```json
{
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "site_name": "mytrialsite",
    "status": "completed",
    "percent_complete": 100,
    "region": "us-east-1",
    "_links": {
        "site": { "href": "https://ppd2005c06prod.prod.acquia-sites.com" },
        "admin": { "href": "https://ppd2005c06prod.prod.acquia-sites.com/user/login?token=abc123def456" }
    }
}
```

- **Live site URL** — `_links.site.href`. This is the public URL for the provisioned Drupal site. Only present when `status` is `completed`.
- **Admin sign-in link** — `_links.admin.href`. A one-time login link that signs the user straight into the Drupal admin — no separate credentials needed. Only present when `status` is `completed`. Single-use and expiring: report it verbatim and never fetch, open, or test it yourself.
- **`_links.self` is not the site** — it is the trial's API record URL. Do not give it to the user as the site link.
- If `status` is `pending` or `in-progress`, neither link exists yet — report `percent_complete` instead and poll again shortly.
- An **empty or near-empty response body** in the first minute after create is normal (provisioning has not registered yet). Treat it as `pending` and keep polling; do not read it as failure.
- Returns **404** if the user has no active trial (none created yet, or an old one is gone) — treat that as "no trial exists," not an error to surface raw.

**There is no way to look up a trial by ID from the CLI.** `GET /trials/{trialId}` is REST-only in the spec (`cli.enabled: false`) — always use `api:account:find-trial` for the current user's own trial.

---

## Create a Trial

```bash
acli api:trials:create <site_name> <site_template_id> <region>
```

| Argument | Required | Description |
|---|---|---|
| `site_name` | Yes | Name for the trial site. **Lowercase letters and digits only, must start with a letter, max 60 characters** (`^[a-z][a-z0-9]*$`) — no hyphens, underscores, or uppercase. A **400** is returned if this pattern isn't met. |
| `site_template_id` | Yes | Drupal template ID — see [List Templates](#list-available-drupal-templates) below to resolve a name to an ID |
| `region` | Yes | AWS region for provisioning — see [List Regions](#list-available-regions) below |

```bash
# Example
acli api:trials:create mytrialsite umami us-east-1
```

**Before calling this:**
1. Run `api:account:find-trial` first. If it returns an existing trial (any status other than a 404), do not call `api:trials:create` again — the API returns **409 Conflict** for a second active trial. Report the existing trial's status instead.
2. Resolve `site_template_id` and `region` via the list commands below rather than guessing or hardcoding a value — available templates and regions change over time. Both are **closed lists**: never send a template ID or region that did not come from `api:trials:list-templates` / `api:trials:list-regions`, even if the user names one that is not listed — tell them what is available instead. Validate all three arguments against the lists before any API call.
3. If the user's requested name doesn't fit the `site_name` pattern above, propose a sanitized version (e.g. lowercased, hyphens/spaces stripped) and confirm it with the user before calling this.
4. Put the site name, template and region in **one message** and get a single explicit go-ahead. "Use defaults", or values the user already gave, count. This confirmation is required even though the user already signed in: creating a trial is an action on their real account and is approved separately from authenticating.

On an invalid site name or unsupported region (**400**), fix the value, re-confirm with the user if it differs from what they approved, and retry once.

On success (`202`), the response is a message + `_links.self` pointing at the new trial resource — **not** the full `Trial` object. Poll `api:account:find-trial` afterward to track provisioning and eventually get the site URL. **Don't rely on `--task-wait`** — trials responses have no `_links.notification`, so ACLI prints the response, warns that there is no task to wait for, and exits successfully without waiting. Poll `api:account:find-trial` instead.

**403 Forbidden:** the account is already associated with an Acquia organization and is not eligible for a trial. Do not re-run `auth:login` and do not retry create — stop and tell the user.

---

## Retry a Failed Trial

```bash
acli api:trials:retry <trialId>
```

Only call this when `api:account:find-trial` shows `status: failed` — the API returns **409 Conflict** if the trial isn't currently in a failed state. The `trialId` is the failed trial's `id` field (also embedded in the `_links.retry.href` URL on the failed trial resource).

```bash
# Example — id from a failed api:account:find-trial response
acli api:trials:retry c3d4e5f6-a7b8-9012-cdef-123456789012
```

After retrying, the trial goes back to `in-progress` — continue polling `api:account:find-trial`. Retry **once** only: if it fails again, relay the failure reason to the user instead of retrying further.

---

## List Available Drupal Templates

```bash
acli api:trials:list-templates
```

Supports pagination: `--offset=<n>` and `--limit=<n>`.

Returns each template's `id` (pass this as `site_template_id` to `api:trials:create`), `name`, `description`, `tags`, and `features`. Present **every** returned template to the user by name in one numbered list — do not offer an "Other" or free-text option, and do not shorten the list. Pick the one that best matches the user's request ("something for a nonprofit", "a food/restaurant site") against the `name`/`description`/`tags` fields and mark it as the default; fall back to the blank starter template if nothing matches well. Either way, **confirm the chosen template with the user conversationally** before creating the trial — don't silently select one.

```json
{ "id": "umami", "name": "Umami", "description": "...food and beverage websites...", "tags": ["Food & Beverage", "E-commerce", "Events"] }
```

---

## List Available Regions

```bash
acli api:trials:list-regions
```

Supports pagination: `--offset=<n>` and `--limit=<n>`.

Returns each region's `id` (pass this as `region` to `api:trials:create`) and human-readable `name`.

```json
{ "id": "us-east-1", "name": "US East (N. Virginia)" }
```

If the user doesn't specify a region, default to `us-east-1` when it is in the list — but make the choice transparent to the user, don't select it silently. If only one region is returned, skip the question entirely and use it.

---

## Typical Workflow: Create and Watch a Trial to Completion

```bash
# 1. Check there isn't already an active trial
acli api:account:find-trial

# 2. Resolve template + region if not already known
acli api:trials:list-templates
acli api:trials:list-regions

# 3. Create the trial
acli api:trials:create mytrialsite umami us-east-1

# 4. Poll until status is "completed" or "failed"
acli api:account:find-trial
```

Once `status: completed` (typically a couple of minutes), read `_links.site.href` for the live URL and `_links.admin.href` to sign the user in. Then ask what the user wants next (open the site, work locally, or start building) rather than following a fixed script.

---

## Troubleshooting

### "400 Bad Request" / validation error on `api:trials:create`

`site_name` must match `^[a-z][a-z0-9]*$` (lowercase letters/digits only, starts with a letter, max 60 chars). Strip hyphens, underscores, and uppercase from the requested name before calling `api:trials:create`.

### "409 Conflict" on `api:trials:create`

The user already has an active trial. Run `api:account:find-trial` to see its current status — don't retry create.

### "409 Conflict" on `api:trials:retry`

The trial isn't in a `failed` state. Run `api:account:find-trial` to check the current status; only failed trials can be retried.

### `api:account:find-trial` returns 404

The user has no active trial. Offer to create one with `api:trials:create`.

### No `_links.site` in the response

The trial hasn't finished provisioning. Check `status` — it must be `completed` before a site URL exists. Keep polling `api:account:find-trial`.

---

## Authentication

Trial commands require authentication first:

```bash
acli auth:login
```

With no credentials stored, this now defaults to **device code sign-in** — no API key needed:

1. ACLI prints a verification URL and a short user code, and opens the URL in a browser if one is available locally.
2. The developer opens that URL (any device/browser), signs in with Google or the email form, confirms the code, and accepts the trial agreement and acceptable use policy shown on that same page.
3. ACLI polls in the background and stores the resulting token once approved.

That click signs the developer in and records their acceptance of the trial terms. It is **not** approval of a specific trial: no site name, region or template has been decided yet (see step 4 under [Create a Trial](#create-a-trial)). An existing password-based Acquia ID cannot sign in with Google; the page shows a message to use username and password instead. Relay it and do not retry Google. If the developer declines the terms, the command returns a result to relay and no trial is created.

For an agent driving this: the command blocks on user action in another browser tab, so surface the printed URL/code to the user and wait — don't treat the blocking as a hang. Declining or letting the code expire (10 minutes) makes the command exit with an error ("Authorization denied." / "Code expired.") rather than hanging silently — see [Troubleshooting](../troubleshooting/SKILL.md#device-code-sign-in-fails) for these and the "Acquia ID may already exist" failure.

If credentials are already stored, `auth:login` offers to switch sign-in methods instead of just re-running the same one (see `acli auth:login --help` for the exact prompts). Pass `--use-legacy-auth`, or `--key`/`--secret`, to force the classic API key/secret flow (see [Getting Started](../getting-started/SKILL.md)) instead of device code.

### Check who is signed in before and after login

Before signing in, run `acli api:accounts:find -n`. If it returns an account, credentials from an earlier setup are active, and with `-n` `auth:login` keeps using them instead of starting a new sign-in. Tell the user which email is signed in and ask whether to use it for the trial; if they want a different account, run `acli auth:logout -n` (stored keys are deactivated, not deleted), then sign in again. An authentication error means nothing is active — continue to sign-in.

Immediately after sign-in, before asking about template, region or site name, confirm the signed-in email with `acli api:accounts:find -n`, then check for an existing trial with `acli api:account:find-trial -n`:

- **404 / no trial** — continue to create.
- **`completed`** — give the user the site and admin links and stop. Do not create another trial.
- **`failed`** — run `acli api:trials:retry <trialId> -n` once, then poll.
- **`pending` with a `site_name`** — provisioning is in progress. Poll; do not create.
- **`pending` with `site_name: null`** — stuck trial, see the lifecycle table above. Stop and direct the user to Acquia Support with the trial ID.

---

## SSH Access on Trials

Trial SSH is stricter than a regular Cloud environment: **Drush over SSH only**. Interactive shells, rsync, scp and sftp are all rejected — a denial there is expected, not an error to retry. After adding an SSH key, do not test it with a plain `ssh` against the trial; use the key for `git clone` only.

---

## Related Topics

- **[Getting Started](../getting-started/SKILL.md)** — Authentication (`acli auth:login`) required before any trial command
- **[MEO Overview](../meo-overview/SKILL.md)** — For provisioned sites that later move to a full MEO/ACE subscription
