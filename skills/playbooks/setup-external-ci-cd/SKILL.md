---
name: setup-external-ci-cd
description: "Setting up external CI/CD with Acquia application"
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: workflow
    platform: "ACE (Acquia Cloud Platform)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, ace, ci-cd, byot, github-actions, gitlab, push-artifact, code-switch"
    software_requirements: "acli>=2.x"
---

# Setting up external CI/CD for Cloud Platform (Drupal)

Connect your own CI/CD tool (GitHub Actions, GitLab CI/CD, or any Linux CI) to Acquia Cloud Platform:
your pipeline builds a deployable artifact, pushes it to the application's Acquia Git repository, and
Cloud Platform runs the Drupal deployment operations server-side. Every step has an `acli` command, so
the whole workflow is scriptable.

Use when:
- Wiring an existing GitHub/GitLab (or other) pipeline to build and deploy Drupal to Cloud Platform
- Migrating off Acquia Pipelines while keeping the same deploy-branch convention
- Scripting artifact build (`push:artifact`) and environment deploys (`code-switch`) in CI

> For the complete reference (full provider templates, appendices, and background), see the
> [Acquia documentation](https://docs.acquia.com/).

**Provider setup files** — read the one matching the customer's CI tool:
- [github-actions.md](./github-actions.md) — GitHub Actions workflow files
- [gitlab-ci.md](./gitlab-ci.md) — GitLab CI/CD `.gitlab-ci.yml`

**Related skills:** [ssh-key-management](../../acli/ssh-key-management/SKILL.md) ·
[environment-management](../../acli/environment-management/SKILL.md) ·
[remote-access](../../acli/remote-access/SKILL.md) ·
[scripting](../../acli/scripting/SKILL.md) ·
[codestudio](../../acli/codestudio/SKILL.md) (Acquia's built-in alternative).

---

## Scope — ACE only, not MEO

Applies to **Cloud Platform applications** that have their own Acquia Git repository with `dev`/`test`/`prod`
environments. **MEO codebases are not supported** (different deployment model). Confirm before starting:

```bash
acli api:codebases:get-by-application <applicationUuid>
```

If the application resolves to a codebase, stop — this workflow does not apply.

## How it works

Two mechanisms connect CI to Cloud Platform:

1. **SSH key** — your runner authenticates to the Acquia Git remote with a registered key to push the artifact.
2. **Acquia CLI** — `acli push:artifact` builds a sanitized artifact (runs `composer install`, commits `vendor/`
   and scaffold files even when gitignored) and pushes it to a deploy branch + immutable tag;
   `acli api:environments:code-switch` points an environment at that ref, triggering the deploy and the
   server-side `post-code-deploy` hook (`updatedb`, `config:import`, `cache:rebuild`).

Pipeline flow: **CI** (composer validate/audit, phpcs, phpstan — on push *and* PR) → **build & push** (push only)
→ **deploy dev** (auto) → **deploy test/prod** (manual approval). The artifact is built **once** and tagged;
each environment is switched to that same immutable tag, so `test`/`prod` get exactly what was validated on `dev`.

**Deploy-branch convention** (keep Acquia's naming so hooks/environments match): `main` → `pipelines-build-main`,
`master` → `pipelines-build-master`. The prefix is `pipelines-build-` (plural).

## Prerequisites

- A Cloud Platform application (not MEO) and a user with the **SSH push** permission.
- Admin access to the GitHub/GitLab repo (to add secrets and approval rules).
- A Composer-based Drupal codebase with the standard `docroot/` layout and `drush/drush` in `composer.json`.
- Runner with Linux, PHP matching the app's version (see [Determine the PHP version](#determine-the-php-version)) + Composer v2, Git, SSH, and Node/npm if the theme builds assets.

**Local CLI tools** used to run this setup — the AI should verify each is present and install it if missing:

| Tool | Check | Install if missing |
| --- | --- | --- |
| `acli` (Acquia CLI) | `acli --version` | `curl -sSL https://github.com/acquia/cli/releases/latest/download/acli.phar -o /usr/local/bin/acli && chmod +x /usr/local/bin/acli` |
| `gh` (GitHub CLI) — GitHub only | `gh --version` | See [cli.github.com](https://cli.github.com/) (e.g. `brew install gh`) |
| `glab` (GitLab CLI) — GitLab only | `glab --version` | See [gitlab.com/gitlab-org/cli](https://gitlab.com/gitlab-org/cli) (e.g. `brew install glab`) |
| `git`, `ssh` | `git --version` / `ssh -V` | Usually preinstalled |

### Determine the PHP version

Do **not** assume a PHP version — derive the app's actual version and use it for the CI runner and the `image`/`php-version` in the provider files. In order of preference:

```bash
# 1. From an existing Acquia Pipelines config, if the project has one
grep -iE 'php[-_ ]?version|version:' acquia-pipelines.yml acquia-pipelines.yaml 2>/dev/null

# 2. From the codebase's Composer constraint
composer config platform.php 2>/dev/null || grep -E '"php"' composer.json

# 3. From the environment itself (authoritative)
acli api:environments:find <environmentId> --no-interaction   # look for the phpVersion field
```

Substitute the value wherever the provider files reference `<PHP_VERSION>`.

---

## Setup (one-time)

### 1. Authenticate Acquia CLI

```bash
acli api:accounts:token-create 'BYOT CI/CD'                 # prints key + secret ONCE — store them
acli auth:login --key="<key>" --secret="<secret>" --no-interaction
acli api:accounts:find                                      # verify
```

The token inherits the creating user's permissions, so that user needs access to the app and its environments.

### 2. Generate and register an SSH key

Use a dedicated key — never a personal one:

```bash
acli ssh-key:create-upload --filename=acquia_byot_cicd --label='BYOT CI/CD' --no-interaction
acli ssh-key:list                                           # verify registration
```

Produces `~/.ssh/acquia_byot_cicd` (private → CI secret) and `.pub` (registered). To register an existing key:
`acli ssh-key:upload --filepath=<path.pub> --label='BYOT CI/CD'`. See [ssh-key-management](../../acli/ssh-key-management/SKILL.md).

### 3. Gather application values

```bash
acli api:applications:list                                  # find the UUID
acli app:vcs:info <applicationUuid>                         # Acquia Git URL
acli api:applications:environment-list <applicationUuid>    # dev/test/prod environment IDs
```

Git URL form: `<sitename>@svn-XXXXX.prod.hosting.acquia.com:<sitename>.git`. Record the env IDs as CI variables.

### 4. Add CI/CD secrets

| Secret | Value |
| --- | --- |
| `ACQUIA_CLI_KEY` / `ACQUIA_CLI_SECRET` | API token from Step 1 |
| `ACQUIA_SSH_PRIVATE_KEY` | Full contents of `~/.ssh/acquia_byot_cicd` (incl. BEGIN/END) |
| `ACQUIA_SSH_PASSPHRASE` | Key passphrase — omit entirely if none |
| `ACQUIA_GIT_URL` | Acquia Git URL from Step 3 |
| `ACQUIA_APP_UUID` | Application UUID |
| `ACQUIA_DEV_ENV_ID` / `ACQUIA_TEST_ENV_ID` / `ACQUIA_PROD_ENV_ID` | Environment IDs |

- **GitHub:** Settings → Secrets and variables → Actions (repository level). Or `gh secret set ACQUIA_SSH_PRIVATE_KEY < ~/.ssh/acquia_byot_cicd`.
- **GitLab:** Settings → CI/CD → Variables (mark Masked, and Protected if the branch is protected). Or `glab variable set ACQUIA_CLI_KEY "<key>" --masked`.

### 5. Create approval gates

- **GitHub:** Settings → Environments. Create `acquia-dev` (no reviewers), `acquia-test`, `acquia-prod` (required
  reviewers). Names must be exactly `acquia-<environment>` — the templates construct them.
- **GitLab:** use `when: manual` on the `deploy-test`/`deploy-prod` jobs (in the template below).

### 6. Add the deployment hook

Cloud Platform runs `hooks/common/post-code-deploy/` after code lands. Create `hooks/common/post-code-deploy/drupal-deploy.sh`:

```sh
#!/bin/sh
# $1 = site name, $2 = target environment
site="$1"; target_env="$2"
set -ev
drush @$site.$target_env updatedb --yes
drush @$site.$target_env config:import --yes
drush @$site.$target_env cache:rebuild
set +v
```

```bash
chmod +x hooks/common/post-code-deploy/drupal-deploy.sh && git add hooks/ && git commit -m "Add post-code-deploy hook"
```

The `hooks/` directory must be in the pushed artifact (`push:artifact` includes it). Validate manually with
`acli remote:drush <environmentId> -- cache:rebuild` (see [remote-access](../../acli/remote-access/SKILL.md)).

---

## The pipeline stages (provider-agnostic)

Every pipeline runs the same three stages. Install acli in the runner first:

```bash
curl -sSL https://github.com/acquia/cli/releases/latest/download/acli.phar -o /usr/local/bin/acli
chmod +x /usr/local/bin/acli
```

**Stage 1 — CI (every push + PR):**

```bash
composer validate --strict --no-interaction
composer install --prefer-dist --no-interaction --no-progress
composer audit --no-interaction
vendor/bin/phpcs --standard=phpcs.xml.dist docroot/modules/custom docroot/themes/custom
vendor/bin/phpstan analyse --configuration=phpstan.neon.dist --no-progress
```

**Stage 2 — Build & push (push only):**

```bash
mkdir -p ~/.ssh && echo "$ACQUIA_SSH_PRIVATE_KEY" > ~/.ssh/id_rsa && chmod 600 ~/.ssh/id_rsa
ssh-keyscan -H "$(echo "$ACQUIA_GIT_URL" | sed 's/.*@//; s/:.*//')" >> ~/.ssh/known_hosts
acli auth:login --key="$ACQUIA_CLI_KEY" --secret="$ACQUIA_CLI_SECRET" --no-interaction
acli push:artifact "$ACQUIA_DEV_ENV_ID" \
  --destination-git-branch="pipelines-build-main" \
  --destination-git-tag="build-${BUILD_ID}" --no-interaction
```

Add front-end builds via a Composer `post-install-cmd` script — `push:artifact` runs Composer scripts.

**Stage 3 — Deploy (point an environment at the tag):**

```bash
# Reference is POSITIONAL, never --branch=. Tags MUST be prefixed with tags/. --task-wait blocks until done.
acli api:environments:code-switch "$ACQUIA_TEST_ENV_ID" "tags/build-${BUILD_ID}" --task-wait --no-interaction
```

---

## Provider-specific CI files

The stages above are packaged as ready-to-use CI files per provider. Read only the file for the customer's
tool and write the templates it contains, substituting `<PHP_VERSION>` (see
[Determine the PHP version](#determine-the-php-version)) and the deploy branch:

- **GitHub Actions** → [github-actions.md](./github-actions.md) (`.github/workflows/` — orchestrator + reusable ci/build/deploy + connection test)
- **GitLab CI/CD** → [gitlab-ci.md](./gitlab-ci.md) (single `.gitlab-ci.yml` with `when: manual` approval gates)

---

## Day-to-day

- **Normal push:** `git push origin main` → CI → build → deploy dev; test/prod wait for approval.
- **Approve test/prod:** GitHub Actions → the waiting deploy job → *Review deployments → Approve*; GitLab → run the
  manual `deploy-test`/`deploy-prod` job.
- **Deploy/rollback an existing tag** (no rebuild): `acli api:environments:code-switch "$ENV_ID" "tags/build-1234" --task-wait`.

## ACLI command reference

| Step | Command |
| --- | --- |
| Create / list API tokens | `acli api:accounts:token-create '<label>'` · `acli api:accounts:tokens-list` |
| Authenticate / verify | `acli auth:login --key=<k> --secret=<s>` · `acli api:accounts:find` |
| Generate + register SSH key | `acli ssh-key:create-upload --filename=<name> --label='<label>'` |
| App details / Git URL / env IDs | `acli api:applications:find <uuid>` · `acli app:vcs:info <uuid>` · `acli api:applications:environment-list <uuid>` |
| Confirm ACE vs MEO | `acli api:codebases:get-by-application <uuid>` |
| Build + push artifact | `acli push:artifact <envId> --destination-git-branch=<branch> --destination-git-tag=<tag>` |
| Deploy a branch/tag | `acli api:environments:code-switch <envId> <reference> --task-wait` |
| Verify / logs / drush | `acli api:environments:find <envId>` · `acli app:log:tail <envId>` · `acli remote:drush <envId> -- <cmd>` |

Add `--no-interaction` to every command used in a pipeline.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Permission denied (publickey)` on push | Compare `ssh-add -L` against `acli ssh-key:list`; re-paste the full private key; allow time for propagation; confirm the **SSH push** permission. |
| `Host key verification failed` | Run `ssh-keyscan` against the host from `ACQUIA_GIT_URL` before pushing. |
| `The --branch option does not exist` | Pass the reference **positionally**: `acli api:environments:code-switch <envId> <reference>`. |
| A tag deploys as a branch / not found | Prefix release tags with `tags/`, e.g. `tags/build-1234`. |
| Job reports success before the site updates | Add `--task-wait` (or poll `acli app:task-wait <uuid>`). |
| Commands fail against a codebase ID | Target is an MEO codebase — not supported (see Scope). |
| Push succeeds but the hook didn't run | Ensure `hooks/common/post-code-deploy/<script>.sh` is in the pushed ref and committed executable. |
| Hook runs but `drush` fails | Check the task log; reproduce with `acli remote:drush <envId> -- config:import`. |
