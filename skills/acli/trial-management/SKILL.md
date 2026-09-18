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

**Note:** The Trials API is a lightweight, pre-MEO provisioning surface — separate from both `acli api:*` (ACE) and `acli api:v3:*` (MEO). Commands use the flat `trials:*` / `account:*` namespace shown below. A user can have only **one active trial at a time**.

---

## The Trial Lifecycle

```
trials:create ──▶ pending ──▶ in-progress ──▶ completed
                                    │
                                    └────────▶ failed ──▶ trials:retry ──▶ in-progress
```

`status` is always one of: `pending`, `in-progress`, `completed`, `failed`. Poll with `account:find-trial` — never assume completion, always check `status` before trusting `_links`.

| Status | What's available |
|---|---|
| `pending` / `in-progress` | `percent_complete` (0-100 integer) only. No site link yet. |
| `completed` | `_links.site` (live public URL) and `_links.admin` (one-time sign-in link) both appear. |
| `failed` | `_links.retry` appears. Call `trials:retry`, not `trials:create` again. |

---

## Check Your Trial (and get the live site URL)

```bash
acli account:find-trial
```

This looks up **your own** trial account — no ID argument needed. This is the command to poll after creating a trial, and the command to use whenever an agent or user asks "where's my site?" / "is my trial ready?".

Example response once provisioning finishes:

```json
{
    "trial_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "site_name": "my-trial-site",
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

**There is no way to look up a trial by ID from the CLI.** `GET /trials/{trialId}` is REST-only in the spec (`cli.enabled: false`) — always use `account:find-trial` for the current user's own trial.

---

## Create a Trial

```bash
acli trials:create <site_name> <site_template_id> <region>
```

| Argument | Required | Description |
|---|---|---|
| `site_name` | Yes | Name for the trial site |
| `site_template_id` | Yes | Drupal template ID — see [List Templates](#list-available-drupal-templates) below to resolve a name to an ID |
| `region` | Yes | AWS region for provisioning — see [List Regions](#list-available-regions) below |

```bash
# Example
acli trials:create my-trial-site umami us-east-1
```

**Before calling this:**
1. Run `account:find-trial` first. If it returns an existing trial (any status other than a 404), do not call `trials:create` again — the API returns **409 Conflict** for a second active trial. Report the existing trial's status instead.
2. Resolve `site_template_id` and `region` via the list commands below rather than guessing or hardcoding a value — available templates and regions change over time.

On success (`202`), the response is a message + `_links.self` pointing at the new trial resource — **not** the full `Trial` object. Poll `account:find-trial` afterward to track provisioning and eventually get the site URL.

---

## Retry a Failed Trial

```bash
acli trials:retry <trialId>
```

Only call this when `account:find-trial` shows `status: failed` — the API returns **409 Conflict** if the trial isn't currently in a failed state. The `trialId` is the failed trial's `trial_id` field (also exposed as `_links.retry.href` on the failed trial resource).

```bash
# Example — trial_id from a failed account:find-trial response
acli trials:retry c3d4e5f6-a7b8-9012-cdef-123456789012
```

After retrying, the trial goes back to `in-progress` — continue polling `account:find-trial`.

---

## List Available Drupal Templates

```bash
acli trials:list-templates
```

Supports pagination: `--offset=<n>` and `--limit=<n>`.

Returns each template's `id` (pass this as `site_template_id` to `trials:create`), `name`, `description`, `tags`, and `features`. Use this to match a user's request ("something for a nonprofit", "a food/restaurant site") to a template `id` — don't hardcode a template.

```json
{ "id": "umami", "name": "Umami", "description": "...food and beverage websites...", "tags": ["Food & Beverage", "E-commerce", "Events"] }
```

---

## List Available Regions

```bash
acli trials:list-regions
```

Supports pagination: `--offset=<n>` and `--limit=<n>`.

Returns each region's `id` (pass this as `region` to `trials:create`) and human-readable `name`.

```json
{ "id": "us-east-1", "name": "US East (N. Virginia)" }
```

If the user doesn't specify a region, pick the closest sensible default (e.g. `us-east-1`) rather than prompting unnecessarily.

---

## Typical Workflow: Create and Watch a Trial to Completion

```bash
# 1. Check there isn't already an active trial
acli account:find-trial

# 2. Resolve template + region if not already known
acli trials:list-templates
acli trials:list-regions

# 3. Create the trial
acli trials:create my-trial-site umami us-east-1

# 4. Poll until status is "completed" or "failed"
acli account:find-trial
```

Once `status: completed`, read `_links.site.href` for the live URL and `_links.admin.href` to sign the user in.

---

## Troubleshooting

### "409 Conflict" on `trials:create`

The user already has an active trial. Run `account:find-trial` to see its current status — don't retry create.

### "409 Conflict" on `trials:retry`

The trial isn't in a `failed` state. Run `account:find-trial` to check the current status; only failed trials can be retried.

### `account:find-trial` returns 404

The user has no active trial. Offer to create one with `trials:create`.

### No `_links.site` in the response

The trial hasn't finished provisioning. Check `status` — it must be `completed` before a site URL exists. Keep polling `account:find-trial`.

---

## Related Topics

- **[Getting Started](../getting-started/SKILL.md)** — Authentication (`acli auth:login`) required before any trial command
- **[MEO Overview](../meo-overview/SKILL.md)** — For provisioned sites that later move to a full MEO/ACE subscription
