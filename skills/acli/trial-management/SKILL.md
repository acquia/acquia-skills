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
- **Admin sign-in link** — `_links.admin.href`. A one-time login link that signs the user straight into the Drupal admin — no separate credentials needed. Only present when `status` is `completed`.
- If `status` is `pending` or `in-progress`, neither link exists yet — report `percent_complete` instead and poll again shortly.
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
2. Resolve `site_template_id` and `region` via the list commands below rather than guessing or hardcoding a value — available templates and regions change over time.
3. If the user's requested name doesn't fit the `site_name` pattern above, propose a sanitized version (e.g. lowercased, hyphens/spaces stripped) and confirm it with the user before calling this.

On success (`202`), the response is a message + `_links.self` pointing at the new trial resource — **not** the full `Trial` object. Poll `api:account:find-trial` afterward to track provisioning and eventually get the site URL. **Do not pass `--task-wait`** — trials responses have no `_links.notification`, so ACLI will error.

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

After retrying, the trial goes back to `in-progress` — continue polling `api:account:find-trial`.

---

## List Available Drupal Templates

```bash
acli api:trials:list-templates
```

Supports pagination: `--offset=<n>` and `--limit=<n>`.

Returns each template's `id` (pass this as `site_template_id` to `api:trials:create`), `name`, `description`, `tags`, and `features`. Use this to semantically match a user's request ("something for a nonprofit", "a food/restaurant site") against the `name`/`description`/`tags` fields — don't hardcode a template. If nothing matches well, fall back to the blank starter template; either way, **confirm the chosen template with the user conversationally** before creating the trial — don't silently select one.

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

If the user doesn't specify a region, pick a sensible default from the `api:trials:list-regions` output (e.g. `us-east-1` for US users) rather than hardcoding one or prompting unnecessarily — but make the choice transparent to the user, don't select it silently.

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

Once `status: completed`, read `_links.site.href` for the live URL and `_links.admin.href` to sign the user in.

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

Today this is the standard API key flow (see [Getting Started](../getting-started/SKILL.md)): a browser opens to generate a key/secret pair, which `auth:login` then prompts for.

**TODO:** Agent-driven trials are designed around device-code sign-in instead (the developer approves in a browser — including Google sign-in — with no API key needed), tracked in [acquia/cli#2049](https://github.com/acquia/cli/pull/2049) (DEVXPT-35). Until that lands, agents must still walk the user through the API key flow above.

---

## Related Topics

- **[Getting Started](../getting-started/SKILL.md)** — Authentication (`acli auth:login`) required before any trial command
- **[MEO Overview](../meo-overview/SKILL.md)** — For provisioned sites that later move to a full MEO/ACE subscription
