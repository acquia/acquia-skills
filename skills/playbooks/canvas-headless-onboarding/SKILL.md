---
name: canvas-headless-onboarding
description: "Use when a customer wants to configure Drupal Canvas headless (decoupled) on an Acquia Cloud Platform application: update Canvas to the latest 1.x, enable the canvas_headless submodule via Drush, scaffold or wire up a Next.js/Nuxt/Astro/TanStack Start frontend, register the frontend URL across every Cloud environment with config_split, and deploy the frontend to Acquia Front End Hosting - Advanced."
license: Proprietary
compatibility: drupal>=11.3, php>=8.3, node>=22.19.0, composer>=2.x, drush>=13, acli>=2.x
metadata:
    category: workflow
    author: Acquia
    version: "1.0.0"
    tags: "drupal, canvas, headless, decoupled, nextjs, nuxt, astro, tanstack-start, config-split, acquia-cloud, node-hosting, front-end-hosting"
    software_requirements: "drupal>=11.3, php>=8.3, node>=22.19.0, composer>=2.x, drush>=13, acli>=2.x"
---

# Canvas Headless Onboarding

Use when:
- A customer wants to run Drupal Canvas with a decoupled frontend (Next.js, Nuxt, Astro, or TanStack Start)
- Canvas is already installed coupled and needs the headless submodule turned on
- The frontend URL has to be registered on more than one Acquia Cloud environment
- A scaffolded or existing frontend needs to be deployed to Acquia Front End Hosting - Advanced

> **Prerequisites:** The following skill sets should be loaded: `acli`, `drupal-maintenance`. `pipelines-cli` is only needed if the customer uses Acquia Pipelines for the frontend build.

> **Scope: this playbook targets ACE subscriptions.** The `acli api:*` commands below are ACE (V2). Confirm the subscription type before Step 4:
> ```bash
> acli api:applications:list          # ACE: this is the entry point
> acli api:v3:sites:list              # MEO: returns results
> ```
> If it is **MEO**, stop before Step 4 and read **[MEO Overview](../../acli/meo-overview/SKILL.md)**. Steps 0–3 and 5–9 still apply, but two things change materially: deployment goes through `acli api:v3:environments:create-deployment` rather than `switchCode` (see **[MEO Deployments](../../acli/meo-deployments/SKILL.md)**), and MEO runs **many Drupal sites per environment** as site instances — so `AH_SITE_ENVIRONMENT` alone cannot key the frontend URL the way Step 3 assumes. A MEO rollout needs the split keyed per site instance, which this playbook does not cover. Raise that with the customer rather than applying Step 3 as written.

> **`canvas_headless` is experimental.** Its `.info.yml` declares `lifecycle: experimental` and `hidden: true` — it never appears on `/admin/modules`, which is why Drush is the only way to enable it. Its APIs, hooks, and configuration may change without a deprecation path. Say this out loud to the customer before starting, and confirm they accept it on a production application.

---

## Step 0 — Preflight: verify versions before touching anything

Run all four checks and report the results together. Do not start the install if any of them fail.

```bash
# Node — Canvas headless templates require Node 22.19.0+ (or 24.5.0+)
node -v

# Composer
composer --version

# Drupal core and PHP, as the site actually reports them
drush status --field=drupal-version
drush status --field=php-version

# Confirm the Drupal codebase is clean before adding packages
git status
```

**Required versions:**

| Requirement | Version | Source |
|-------------|---------|--------|
| Drupal core | `^11.3` | `canvas.info.yml` → `core_version_requirement: ^11.3` |
| PHP | `8.3` | `canvas.info.yml` → `php: 8.3` |
| Node | `>=22.19.0 <23` or `>=24.5.0` | headless template `package.json` → `engines.node` |
| Drush | 13+ | `pm:install`, `config-split:*` commands |

> **Drupal 11.0 is not enough.** Canvas 1.x requires core `^11.3`. If `drush status` reports 11.0, 11.1, or 11.2, Canvas headless cannot be installed until core is upgraded. Stop here, tell the customer their current core version and that `^11.3` is the floor, and hand off to **[Dependency Updates](../../drupal-maintenance/dependency-updates/SKILL.md)** for the core minor upgrade. Return to Step 1 only once `drush status` reports 11.3 or later.

> **Node 22 is the target.** If `node -v` reports anything below 22.19.0, ask the customer to switch before scaffolding — the templates ship an `.nvmrc` pinned to `22`. If they use nvm: `nvm install 22 && nvm use 22`. Acquia Front End Hosting - Advanced supports Node 22 (npm 11.6.3) and Node 24 (npm 11.7.0) only, so staying on 22 keeps local and hosted runtimes aligned.

---

## Step 1 — Update Canvas to the latest 1.x

Check what is currently installed:

```bash
composer show drupal/canvas 2>/dev/null || echo "Canvas not installed"
```

Then require or update to the latest 1.x:

```bash
# New install, or moving an existing install onto the latest 1.x
composer require 'drupal/canvas:^1.10' --with-all-dependencies
```

If Canvas is already present and only needs updating:

```bash
composer update drupal/canvas --with-all-dependencies
```

Confirm the resolved version and that core was not downgraded:

```bash
composer show drupal/canvas | grep -E '^(name|versions)'
drush status --field=drupal-version
```

> If Composer refuses the requirement, it is almost always the core constraint. Report the conflict verbatim rather than adding `--ignore-platform-reqs` or loosening the core constraint — Canvas genuinely needs `^11.3`.

---

## Step 2 — Enable the headless submodule via Drush

`canvas_headless` declares these dependencies, which Composer must supply before Drush can enable it:

| Package | Constraint | Why |
|---------|-----------|-----|
| `drupal/simple_oauth` | `>=6.1.0` | Signs the RFC 7523 preview assertions |
| `drupal/consumers` | — | OAuth consumer entity |
| `drupal/custom_elements` | — | Serializes the component tree |

```bash
composer require drupal/simple_oauth:^6.1 drupal/consumers drupal/custom_elements
```

Enable Canvas and the headless submodule. Add `canvas_oauth` too — the Canvas CLI needs it for `pull`/`push` in Step 6:

```bash
drush pm:install canvas canvas_headless canvas_oauth --yes
drush cache:rebuild
```

Verify the modules are actually enabled (`canvas_headless` is hidden, so the Extend page is not a reliable check):

```bash
drush pm:list --status=enabled --filter=canvas
drush config:status
```

### 2a — Generate the Simple OAuth keypair

Canvas headless signs preview assertions with Simple OAuth's RSA keypair. Generate it **outside the docroot** so the keys are never web-servable and never committed:

```bash
# Path must be outside docroot and outside version control
drush simple-oauth:generate-keys ../keys
```

Then confirm Drupal is happy with the keys:

```bash
drush core:requirements --severity=1
```

> **The keypair is deliberately per-environment.** The `canvas_headless` README is explicit: *"In cloned environments, regenerate the Simple OAuth keypair per environment; with shared keys, preview credentials minted on one clone would redeem on another."* This is the one piece of setup that must **not** be shared or deployed. Generate a fresh pair on every Acquia environment. Flag this to the customer as a security requirement, not a preference.

> **The key *paths* are config, though.** `simple_oauth.settings` stores `public_key` and `private_key` as `type: path`, so they export to `config/sync` and get shared across every environment — while the keys they point at must differ per environment. Resolve the paths from `settings.php` instead of letting the exported value win. See **Step 4b**.

> **Never put these keys in the files directory.** Acquia's file copy operations — the Cloud UI's *Copy files* and `acli pull:files` — sync the public and private files mounts between environments. Keys stored there would propagate from one environment to another, which is exactly the cross-redemption risk the module warns about. Use a per-environment path outside the synced files mount.

### 2b — Grant the two permissions

```bash
# Roles that may manage the site-wide frontend list
drush role:perm:add content_editor 'administer canvas headless frontends'

# Editorial roles that should preview through the frontend app.
# Holders can mint preview credentials for themselves.
drush role:perm:add content_editor 'access canvas headless preview'
```

Ask the customer: **"Which roles should be able to manage headless frontends, and which should be able to preview through them?"** Substitute their role machine names — do not assume `content_editor` exists. List the available roles with `drush role:list` if needed.

> Installing the module provisions the OAuth consumer and scope it needs. There is nothing to create manually.

---

## Step 3 — Configure all Acquia environments in one pass with config_split

An Acquia Cloud application has at least dev, test (stage), and prod, plus any CDEs. Split the setup into what is identical everywhere and what genuinely differs.

### What is identical → plain exported config, deployed once

Do the Step 2 work once (locally or on dev), export, and commit. Every environment picks it up on its next `drush deploy`:

| Config object | Carries |
|---------------|---------|
| `core.extension` | `canvas`, `canvas_headless`, `canvas_oauth`, `simple_oauth`, `consumers`, `custom_elements` |
| `canvas_headless.settings` | `assertion_expiration` (default `60`, valid range 10–300) |
| `simple_oauth.oauth2_scope.canvas_headless` | Shipped by the module's `config/install` |
| `user.role.*` | The two permissions from Step 2b |

### What differs → the frontend URL, one split per environment

`canvas_headless.settings` holds a `frontends` sequence, and the frontend base URL is different on every environment. Give each environment its own split.

**Install and enable config_split:**

```bash
composer require drupal/config_split:^2.0
drush pm:install config_split --yes
```

**Create the split folders as siblings of the sync directory.** They must not be nested inside it:

```bash
# Assuming $settings['config_sync_directory'] = '../config/sync';
mkdir -p ../config/splits/{local,dev,test,prod}
```

The resulting layout:

```
config/
├── sync/
└── splits/
    ├── local/
    ├── dev/
    ├── test/
    └── prod/
```

**Create one split entity per environment.** Use `partial_list` (partially split), not `complete_list`, so `canvas_headless.settings` stays present in `config/sync` and an environment with no active split still has a valid — if inert — object rather than a missing one.

Write `config/sync/config_split.config_split.dev.yml`, and one sibling per environment:

```yaml
langcode: en
status: false
dependencies: {  }
id: dev
label: 'Acquia dev'
description: 'Environment-specific Canvas headless frontend for the dev environment.'
weight: 0
stackable: false
no_patching: false
storage: folder
folder: ../config/splits/dev
module: {  }
theme: {  }
complete_list: {  }
partial_list:
  - canvas_headless.settings
```

> `status: false` in the exported file is deliberate. Splits are switched on per environment from `settings.php` (below), never in the exported config — otherwise every environment would activate every split.

**Put each environment's frontend URL in its split folder.** Write `config/splits/dev/canvas_headless.settings.yml`:

```yaml
frontends:
  -
    url: 'https://dev-frontend.example.com'
assertion_expiration: 60
```

Repeat for `test`, `prod`, and `local` (`http://localhost:3000`).

**Keep the base inert.** `config/sync/canvas_headless.settings.yml` should ship an empty list, so an environment whose split is not active points at nothing instead of at the wrong frontend:

```yaml
frontends: {  }
assertion_expiration: 60
```

**Activate exactly one split per environment from `settings.php`.** This is the only environment-conditional PHP required, and it is a single boolean per split — the URLs themselves stay in git-tracked YAML:

```php
// settings.php — Canvas headless frontend, one split per Acquia environment.
$ah_env = $_ENV['AH_SITE_ENVIRONMENT'] ?? NULL;

if ($ah_env === NULL) {
  // Local development.
  $canvas_split = 'local';
}
elseif (str_starts_with($ah_env, 'ode')) {
  // CDEs report as ode1, ode2, ... — reuse the dev frontend.
  $canvas_split = 'dev';
}
else {
  // AH_SITE_ENVIRONMENT is 'dev', 'test', or 'prod'.
  $canvas_split = ['dev' => 'dev', 'test' => 'test', 'prod' => 'prod'][$ah_env] ?? NULL;
}

if ($canvas_split !== NULL) {
  $config['config_split.config_split.' . $canvas_split]['status'] = TRUE;
}
```

**Export, verify, commit:**

```bash
# Export with the local split active
drush cache:rebuild
drush config:export --yes

# Confirm the active value resolves to the local frontend
drush config:get canvas_headless.settings

# Preview what a deploy would change before pushing
drush config:import --diff --preview=diff
```

At this point the configuration is correct locally but is not live anywhere. **Step 4** releases it.

### Constraints to respect

1. **`frontends` is a sequence and preview uses the first entry.** A split replaces the list; it does not append to it. To change which app serves previews, reorder the list.
2. **The URL regex is strict.** It must be an absolute `http://` or `https://` URL whose host is a hostname or dotted-quad IPv4, with **no trailing slash** and no credentials, query string, fragment, or dot path segments. A trailing slash alone fails validation, because the draft path is appended verbatim and would produce a double slash.
3. **Split-managed config is not editable in the UI per environment.** The "Headless frontends" form edits the active config; the next `drush deploy` restores the split's value. If editors need to own the list themselves, `config_ignore` on `canvas_headless.settings` is the better fit — offer that alternative if the customer pushes back.
4. **Only edit active splits.** config_split will not export changes for an inactive split.
5. **Split folders must never live inside the sync directory.** Siblings only.
6. **CDEs are ephemeral.** Mapping `ode*` to the dev frontend is a pragmatic default. If a customer needs a real per-CDE frontend, each CDE needs its own frontend deployment and its own split — raise this rather than pretending the dev mapping covers it.

---

## Step 4 — Release the Drupal changes to Acquia Cloud

Steps 1–3 changed the Drupal codebase. None of it is live on any Acquia environment yet. Release it now, dev first — that way the disruptive part of this change (Canvas headless replaces the Drupal-rendered preview for *every* entity editing context) is proven on dev while test and prod are untouched.

> **Prefer a single release?** Ask the customer: **"Release the Drupal changes to dev now, or hold everything for one release at the end?"** A team that would rather ship backend and frontend together can defer this step until after Step 8 and run it once. The tradeoff is real: the frontend in Steps 5–7 is then built against a local-only Drupal, and the preview round trip is not exercised on a real environment until the very end. Either way, do not skip this step — run it here or run it there.

### 4a — Review exactly what changed

```bash
git status
git diff --stat
```

Expected to have changed:

| Path | Change |
|------|--------|
| `composer.json`, `composer.lock` | `canvas`, `simple_oauth`, `consumers`, `custom_elements`, `config_split` |
| `config/sync/core.extension.yml` | The newly enabled modules |
| `config/sync/canvas_headless.settings.yml` | Inert base (`frontends: {}`) |
| `config/sync/config_split.config_split.*.yml` | One split entity per environment, all `status: false` |
| `config/splits/*/canvas_headless.settings.yml` | Per-environment frontend URL |
| `config/sync/simple_oauth.settings.yml` | Scope provider and key paths |
| `config/sync/user.role.*.yml` | The two permissions from Step 2b |
| `settings.php` (or its include) | Split activation and key paths |

Walk the diff with the customer before committing, and confirm two things explicitly:

```bash
# No keys may be committed — this must return nothing
git diff --cached --name-only | grep -iE 'key|\.pem$|\.env$'
```

- **No keypair is staged.** The Simple OAuth keys are per-environment and never enter the repo.
- **No `.env` is staged.** Frontend secrets belong nowhere in the Drupal repo.

If either check finds something, unstage it and add it to `.gitignore` before going further.

### 4b — Put the environment-conditional overrides in the right place

Acquia Cloud loads its own settings include, and a `$config` override placed *before* it can be overwritten. Both override blocks — the split activation from Step 3 and the key paths below — must load **after** Acquia's `require` of `/var/www/site-php/...`.

Find where that include happens:

```bash
grep -rn "site-php" docroot/sites/default/settings.php
```

> **Acquia BLT and Drupal Recommended projects own `settings.php`.** If the file is generated or gitignored, do not edit it directly — the next build will discard the change. Those project templates load additional includes from `docroot/sites/default/settings/`; put the block in a file there (for example `settings/canvas_headless.settings.php`) and commit that instead. Check for the directory before choosing where to write:
> ```bash
> ls -la docroot/sites/default/settings/ 2>/dev/null
> git check-ignore -v docroot/sites/default/settings.php
> ```

Add the Simple OAuth key paths, so each environment resolves its own keys while the block itself stays identical everywhere:

```php
// Simple OAuth keys are per-environment and must never be committed or synced.
// Keep them OUT of the files mount: Acquia's "Copy files" and `acli pull:files`
// sync files between environments and would propagate one environment's keys.
if (isset($_ENV['AH_SITE_GROUP'], $_ENV['AH_SITE_ENVIRONMENT'])) {
  $canvas_key_dir = '/mnt/gfs/' . $_ENV['AH_SITE_GROUP'] . '.' . $_ENV['AH_SITE_ENVIRONMENT'] . '/nobackup/oauth-keys';
  $config['simple_oauth.settings']['public_key'] = $canvas_key_dir . '/public.key';
  $config['simple_oauth.settings']['private_key'] = $canvas_key_dir . '/private.key';
}
```

> **Confirm the mount path before committing this.** Cloud Classic and Cloud Next expose different writable mounts, so do not take `/mnt/gfs/...` on faith. SSH into the target environment and verify a writable, non-web-accessible directory exists:
> ```bash
> acli ssh <environment-id>
> echo "$AH_SITE_GROUP.$AH_SITE_ENVIRONMENT"
> ls -ld /mnt/gfs/$AH_SITE_GROUP.$AH_SITE_ENVIRONMENT/nobackup 2>/dev/null || echo "not this path"
> ```
> Adjust the snippet to whatever the environment actually reports. Getting this wrong fails closed — Simple OAuth will report a missing-key requirement rather than silently using a shared key.

### 4c — Commit and push

```bash
git add -A
git commit -m "Configure Drupal Canvas headless with per-environment frontend splits"
```

Then push to Acquia Cloud and deploy. Follow **[Pull & Push](../../acli/pull-push/SKILL.md)** and **[Environment Management](../../acli/environment-management/SKILL.md)** for the full options:

```bash
acli push:code
```

If the customer builds through Acquia Pipelines or Code Studio, trigger the build instead and let it deploy — follow **[Pipeline Operations](../../pipelines-cli/pipeline-operations/SKILL.md)**.

### 4d — Deploy environment by environment, dev first

> ACE commands. On MEO, substitute `acli api:v3:environments:create-deployment` and see the scope note at the top of this skill.

Get the environment IDs:

```bash
acli api:applications:list
acli api:environments:list <app-uuid>
```

Then for **each** environment in order — dev, then test, then prod — run the same three phases. Do not move to the next environment until the current one verifies.

**Phase 1: switch code and run the deploy.**

```bash
acli api:environments:switchCode <environment-id> --branch=<branch-name>
acli ssh <environment-id>
drush deploy
```

`drush deploy` runs `updatedb`, `config:import`, `cache:rebuild`, and `deploy:hook` in the correct order.

> **The first deploy on each environment needs two passes.** `config_split` cannot act on a `status` override until the module itself is installed and the caches have been rebuilt — and on this first deploy the module is being installed by the very same `config:import`. So the split will not apply on pass one. Run:
> ```bash
> drush deploy
> drush cache:rebuild
> drush config:import --yes
> ```
> Subsequent deploys need only `drush deploy`. If the second pass reports no changes to import, the split still is not active — check that `AH_SITE_ENVIRONMENT` matches a key in the Step 3 map.

**Phase 2: generate that environment's keypair.** This cannot be deployed; it has to happen once per environment, on the environment:

```bash
# Still inside `acli ssh <environment-id>`, using the path confirmed in Step 4b
mkdir -p /mnt/gfs/$AH_SITE_GROUP.$AH_SITE_ENVIRONMENT/nobackup/oauth-keys
chmod 700 /mnt/gfs/$AH_SITE_GROUP.$AH_SITE_ENVIRONMENT/nobackup/oauth-keys
drush simple-oauth:generate-keys /mnt/gfs/$AH_SITE_GROUP.$AH_SITE_ENVIRONMENT/nobackup/oauth-keys
drush cache:rebuild
```

**Phase 3: verify this environment before touching the next.**

```bash
drush pm:list --status=enabled --filter=canvas
drush config:get canvas_headless.settings
drush core:requirements --severity=1
```

`drush config:get canvas_headless.settings` must show **this** environment's own frontend URL, not the empty base value and not another tier's URL. If it shows the empty base, the split did not activate — rebuild caches and re-check, since `config_split` requires a cache rebuild after a `status` override changes.

> **Rollback.** The config and code changes revert cleanly with `git revert` plus a redeploy. Two things do not: `canvas_headless` being enabled changes preview behavior the moment it installs, and uninstalling it does not remove the generated keys. If a rollback is needed on prod, `drush pm:uninstall canvas_headless` restores the Drupal-rendered preview immediately — do that first, then revert the code.

Full end-to-end verification comes in **Step 9**, once the frontend exists.

---

## Step 5 — Frontend: existing codebase or new scaffold

Ask the customer: **"Do you already have a frontend codebase, or should we scaffold a new one?"**

- New scaffold → **Step 5A**
- Existing frontend → **Step 5B**

Then ask: **"Which framework?"**

| Framework | Template flag | SDK adapter |
|-----------|---------------|-------------|
| Next.js | `--template nextjs` | `@drupal-canvas/headless-next` |
| Nuxt | `--template nuxt` | `@drupal-canvas/headless-nuxt` |
| Astro | `--template astro` | `@drupal-canvas/headless-astro` |
| TanStack Start | `--template tanstack-start` | `@drupal-canvas/headless-tanstack-start` |

> Canvas Workbench (component preview) ships only in the React templates — Next.js and TanStack Start. Mention this if the customer is weighing Nuxt or Astro against the React options.

---

### Step 5A — Scaffold a new frontend

Confirm the target directory with the customer first, and run the scaffold **outside the Drupal docroot** — the frontend is a separate codebase with its own repository.

```bash
# Interactive: prompts for the template
npx @drupal-canvas/create@latest --experimental-headless
```

Or select the framework directly:

```bash
npx @drupal-canvas/create@latest --template nextjs
```

Each generated project ships draft preview, the Canvas component metadata endpoint, catch-all Drupal page rendering, Tailwind CSS, the Canvas CLI, and a starting set of components from [Nebula](https://github.com/acquia/nebula).

**Wire it to the Drupal site.** Copy `.env.example` to `.env` and fill in the values:

```bash
cd <project-dir>
cp .env.example .env
```

```dotenv
# Base URL of the Drupal site
CANVAS_SITE_URL=https://<drupal-site-url>

# Credentials for Canvas CLI
CANVAS_CLIENT_ID=cli
CANVAS_CLIENT_SECRET=<secret>
```

Ask the customer for the Drupal base URL. For `CANVAS_CLIENT_ID` / `CANVAS_CLIENT_SECRET`, do **not** invent values or read them out of the codebase — direct the customer to their `canvas_oauth` consumer at `/admin/config/services/consumer`, and have them paste the secret into `.env` themselves. `.env` is gitignored by the template; confirm it stays that way.

Then continue to **Step 6**.

---

### Step 5B — Add Canvas to an existing frontend

Confirm the framework and package manager in use, then install the framework-agnostic core plus the matching adapter and the CLI. Next.js example:

```bash
npm install @drupal-canvas/headless @drupal-canvas/headless-next @drupal-canvas/headless-react
npm install --save-dev @drupal-canvas/cli
```

Substitute the adapter from the Step 5 table. React bindings (`@drupal-canvas/headless-react`) are needed for Next.js and TanStack Start; Nuxt and Astro do not need them.

**Add the CLI configuration.** Create `canvas.config.json` in the project root, pointing at the project's real directory layout rather than the defaults:

```json
{
  "componentDir": "src/components",
  "aliasBaseDir": "src",
  "globalCssPath": "src/global.css",
  "sync": {
    "pages": false,
    "contentTemplates": false,
    "regions": false
  }
}
```

> The `sync` flags default to `true`. For an existing frontend, start with all three `false` so a first `canvas pull` brings down code components and global CSS only, without writing pages, content templates, or global regions into the codebase. Turn them on deliberately once the customer wants those managed in code.

**Add the environment file.** Create `.env` with the same three variables as Step 5A, and confirm `.env` is in `.gitignore` before writing any secret into it.

Then continue to **Step 6**.

---

## Step 6 — Bring existing Canvas components into the codebase

Ask the customer: **"Do you want to pull the Canvas components that already exist on your Drupal site into this codebase?"**

If **no**, skip to Step 7.

If **yes**, authenticate first. For an individual developer, interactive login is the better path — it stores tokens in `~/.config/drupal-canvas/oauth.json` and needs no secrets in `.env`:

```bash
npx canvas login --site-url https://<drupal-site-url> --client-id <oauth-client-id>
```

> The consumer must be configured for the Authorization Code grant with `http://localhost:4444/callback` as a redirect URI (or pass `--port` and match it). If login fails on the redirect URI, that mismatch is the usual cause.

For CI/CD or a service account, use client credentials via `CANVAS_CLIENT_ID` / `CANVAS_CLIENT_SECRET` in `.env` instead.

**Pull.** Show the customer what will be written before running it non-interactively:

```bash
# Interactive — prompts for confirmation, shows what it will write
npx canvas pull
```

Useful variants:

```bash
# Components and global CSS only
npx canvas pull --no-pages --no-content-templates --no-regions

# Only new items, never overwrite local work
npx canvas pull --skip-overwrite

# Non-interactive, additive only (CI/CD)
npx canvas pull --yes --skip-overwrite
```

> **`pull` overwrites by default.** Global CSS and a previously pushed `package.json` are written back to the project root and overwritten unless `--skip-overwrite` is passed. On an existing frontend with local changes (Step 5B), always start with `--skip-overwrite` and let the customer review the diff. Run `git status` afterwards and show them what changed.

Review and commit:

```bash
git status
git diff --stat
```

---

## Step 7 — Run the dev server and register the frontend

Start the frontend:

```bash
npm run dev
```

The template dev servers listen on **port 3000**. Keep that port — Acquia Front End Hosting - Advanced requires port 3000 and it is not configurable, so matching locally avoids a surprise at deploy time.

Confirm the local URL is registered as a headless frontend. With the `local` split from Step 3 active, this should already resolve:

```bash
drush config:get canvas_headless.settings
```

Expected: `frontends` contains `http://localhost:3000` — no trailing slash.

If the customer prefers to set it through the UI instead of the split, point them to **Headless frontends** in Canvas and have them add `http://localhost:3000`. Warn them the next `drush deploy` will restore the split's value.

**Smoke-test the round trip.** Open an entity in the Canvas editor. It should load the first frontend in the list with an active draft session, and the preview should be rendered by the frontend app rather than by Drupal.

If it works, continue to Step 8. If it does not, jump to the diagnostic table in **Step 9** rather than guessing — the failure modes are specific and each has a distinct fix.

> Enabling `canvas_headless` **replaces the Drupal-rendered preview for every entity editing context**. An entity without a canonical URL, or one the frontend app does not serve, will show a preview-start failure. Tell the customer this before they enable it on a site with mixed coupled and decoupled content.

---

## Step 8 — Node hosting and deploying the frontend

Ask the customer: **"Where do you want to host the frontend?"**

Then check whether they already have Acquia Front End Hosting - Advanced:

```bash
# List applications visible to the authenticated user
acli api:applications:list
```

Look for a Node.js application alongside the Drupal one. Front End Hosting - Advanced provisions its own application with its own environments, separate from the Drupal application.

> `acli` has no dedicated Front End Hosting commands. If the application list is ambiguous, have the customer check the Cloud Platform UI directly: **Develop → \<organization\> → \<application\> → View \<application name\>**. If no Node.js application exists, the add-on is not provisioned — that is an account/subscription question for their Acquia account team, not something to work around.

**If they have it**, offer to deploy the frontend there, and note that it is a strong fit: it provisions dev, staging, and prod environments that map cleanly onto the three splits from Step 3.

**If they do not have it**, do not block onboarding. The frontend runs on any Node host. Record the customer's choice and finish the setup — the only thing that changes is which URL goes into each split.

### Deploying to Front End Hosting - Advanced

**Platform constraints, all non-negotiable:**

| Constraint | Value |
|------------|-------|
| Node / npm | Node 22 with npm 11.6.3, or Node 24 with npm 11.7.0 |
| Package manager | npm only |
| Port | 3000, preset and managed internally |
| Default environments | dev, staging, prod (more can be purchased) |

**1. Confirm `package.json` is deploy-ready.** The template scripts already satisfy this — `dev`, `build`, `start`. Verify `start` boots the production server on port 3000 and that `engines.node` matches a supported runtime.

**2. Set up the frontend's own git repository.** The frontend deploys from a repository separate from the Drupal repo:

```bash
# Add an SSH key to the Acquia profile first, if not already done
acli ssh-key:list
```

Follow **[SSH Key Management](../../acli/ssh-key-management/SKILL.md)** if no key is registered, then clone the Node application's repository and push the frontend code to it.

**3. Set the build command** in the Node.js hosting build system:

```
npm install && npm run build
```

**4. Set environment variables** per environment in the Cloud UI. At minimum the frontend needs `CANVAS_SITE_URL` pointing at that tier's Drupal environment:

| Frontend environment | `CANVAS_SITE_URL` |
|----------------------|-------------------|
| dev | Drupal dev environment URL |
| staging | Drupal test environment URL |
| prod | Drupal prod environment URL |

> Build-time variables are injected during the build and stay fixed until redeployment. Runtime variables are read at execution and update without a redeploy. `CANVAS_SITE_URL` is read at runtime by the app; `CANVAS_CLIENT_SECRET` is only needed if the build itself runs `canvas pull`. Never commit either.

**5. Deploy the branch** to the target environment from the Cloud UI. This triggers a build automatically. Follow-up commits to the deployed branch deploy automatically.

**6. Close the loop with a second Drupal release.** The splits from Step 3 were authored before the frontend existed, so they hold placeholder or local URLs. Replace each with the real deployed URL:

```bash
# Edit config/splits/<env>/canvas_headless.settings.yml for each environment,
# putting in that tier's deployed frontend URL — absolute, no trailing slash.
drush config:export --yes
git add config && git commit -m "Register deployed frontend URLs per environment"
```

This is a Drupal codebase change, so it releases the same way as the first one. **Re-run Step 4c and 4d** — push, deploy dev → test → prod, verifying at each gate. The keypair phase does not need repeating; keys were generated on the first release.

Each environment must then report its own frontend URL. That closes the loop: the Drupal editor on dev previews through the dev frontend, test through staging, prod through prod. **Step 9** verifies it.

---

## Step 9 — Verify the setup end to end

Ask the customer: **"Do you want me to run a full verification pass now?"** Run it after the first release and again after any change to the splits, the keys, or the frontend URLs. Report the results as a single table — do not stop at the first failure unless it blocks the checks that follow.

### 9a — Backend, on each environment

Run these inside `acli ssh <environment-id>` for **every** environment, and record which environment each result came from:

```bash
# 1. Modules enabled
drush pm:list --status=enabled --filter=canvas

# 2. This environment's own frontend URL — not the base, not another tier's
drush config:get canvas_headless.settings

# 3. Which split actually activated
drush config:status
drush config:get config_split.config_split.dev status
drush config:get config_split.config_split.test status
drush config:get config_split.config_split.prod status

# 4. Keys present, readable, and resolving to this environment's path
drush config:get simple_oauth.settings public_key
drush config:get simple_oauth.settings private_key
drush core:requirements --severity=1

# 5. Permissions landed on the intended roles
drush role:list --filter='access canvas headless preview'

# 6. No config drift between the repo and the active site
drush config:status
```

**Pass criteria:**

| Check | Pass looks like |
|-------|-----------------|
| Modules | `canvas`, `canvas_headless`, `canvas_oauth` all `Enabled` |
| Frontend URL | This environment's own URL, absolute, **no trailing slash** |
| Split status | Exactly **one** split `true`, and it is the one matching `AH_SITE_ENVIRONMENT` |
| Key paths | Resolve under this environment's own directory, outside docroot and outside the files mount |
| Requirements | No error-severity entries from Simple OAuth |
| Config status | `No differences between DB and sync directory` |

### 9b — The cross-environment check that actually matters

The single most valuable verification, because it is the one thing per-environment config is supposed to guarantee and the one thing a broken split silently breaks. Collect the frontend URL from every environment and compare:

```bash
for env in <dev-env-id> <test-env-id> <prod-env-id>; do
  echo "=== $env ==="
  acli ssh "$env" -- drush config:get canvas_headless.settings frontends --format=json
done
```

**Every environment must report a different URL, and each must match its own tier.** Two environments reporting the same URL means a split did not activate and that environment is previewing through the wrong frontend. Two environments sharing a keypair path is the same class of bug and carries the cross-redemption risk from Step 2a.

Also confirm the keys are genuinely distinct, not copies:

```bash
for env in <dev-env-id> <test-env-id> <prod-env-id>; do
  echo "=== $env ==="
  acli ssh "$env" -- sh -c 'md5sum "$(drush config:get simple_oauth.settings public_key --format=string)"'
done
```

Three different checksums is a pass. Any two matching means keys were copied between environments — regenerate on the affected environment per Step 4d, Phase 2.

### 9c — Frontend

```bash
# Node runtime matches a supported version
node -v

# Production build succeeds — catches what the dev server hides
npm run build

# Lint and types (template projects ship this script)
npm run check

# No secrets committed
git check-ignore -v .env
```

`npm run build` passing matters more than `npm run dev` working: Front End Hosting runs `npm install && npm run build`, so a build failure here is a deploy failure there.

### 9d — Preview round trip, per environment

This is the real end-to-end test and it cannot be automated — it needs a browser and a real editor account. Walk the customer through it on each environment:

1. Sign in as a user holding `access canvas headless preview`.
2. Open an entity in the Canvas editor.
3. Confirm the preview is rendered **by the frontend app**, not by Drupal.
4. Edit a field and confirm the change appears in the preview without a full save.
5. Confirm the frontend URL in the browser's network activity matches that environment's tier.

Step 5 is the one people skip and the one that catches a mis-activated split — a dev editor previewing against the prod frontend looks correct until someone notices the content is wrong.

### 9e — Deployed frontend

```bash
# Serves a real page, not a platform error
curl -sS -o /dev/null -w '%{http_code}\n' https://<frontend-url>

# Content endpoint reachable from the frontend's perspective
curl -sS "https://<drupal-url>/canvas/content-api?requestUri=/" | head -c 400
```

The content endpoint should return JSON with `content`, `head`, and `route` keys. `route.managedByCanvas` distinguishes a Canvas-managed route with an empty tree (`true`) from a route Canvas does not manage (`false`) — both return `content: null`, so do not read a null `content` as a failure on its own.

### Diagnostic table

| Symptom | Likely cause |
|---------|--------------|
| Preview fails on every entity | Simple OAuth keypair missing or unreadable — re-run Step 2a (or Step 4d Phase 2 on a Cloud environment), then `drush core:requirements --severity=1` |
| Preview fails for one editor only | That user lacks `access canvas headless preview`, or lacks **view** access to the entity — edit access alone is not enough |
| Preview starts but content is missing | A view permission the preview needs is not declared preview-safe — see `hook_canvas_headless_safe_permissions()` in `canvas_headless.api.php` |
| Preview shows the wrong environment's site | The split did not activate. Check `AH_SITE_ENVIRONMENT` against the Step 3 map, then `drush cache:rebuild && drush config:import` |
| `frontends` is empty on a Cloud environment | First deploy needs the two-pass sequence from Step 4d, Phase 1 |
| Frontend URL rejected on save | Trailing slash, query string, fragment, credentials, or a non-canonical host — see the Step 3 URL constraints |
| Preview blank in Firefox | Plain HTTP, or third-party cookies blocked. Firefox needs HTTPS; Chromium also works on plain-http `localhost` |
| Preview blank in Safari | Safari follows CHIPS availability, unavailable in 18.5–26.1 |
| Published page shows stale content | The rendered-content endpoint serves the default revision; a published entity's forward revision appears only in JSON:API-driven listings, not through `fetchPage()` |
| Build passes locally, fails on Acquia | Node or npm version mismatch, a non-npm lockfile, or a devDependency needed at build time |

---

## Quick Reference

| Step | Action | Command |
|------|--------|---------|
| 0 | Verify versions | `node -v`, `drush status` |
| 1 | Update Canvas | `composer require 'drupal/canvas:^1.10' --with-all-dependencies` |
| 2 | Enable headless | `drush pm:install canvas canvas_headless canvas_oauth --yes` |
| 2a | OAuth keys (per env) | `drush simple-oauth:generate-keys ../keys` |
| 2b | Permissions | `drush role:perm:add <role> 'access canvas headless preview'` |
| 3 | Multi-env config | `drush pm:install config_split`, one split per environment |
| 4 | **Release Drupal** | `acli push:code`, then per env: `drush deploy` + generate that env's keys |
| 5A | Scaffold frontend | `npx @drupal-canvas/create@latest --experimental-headless` |
| 5B | Existing frontend | `npm install @drupal-canvas/headless @drupal-canvas/headless-<framework>` |
| 6 | Pull components | `npx canvas login`, then `npx canvas pull --skip-overwrite` |
| 7 | Dev server | `npm run dev` (port 3000) |
| 8 | Deploy frontend | Front End Hosting - Advanced, build `npm install && npm run build` |
| 9 | **Verify** | Per env: `drush config:get canvas_headless.settings` — every env a different URL |

### Key facts

| Fact | Value |
|------|-------|
| Canvas core requirement | `^11.3` (PHP 8.3) |
| Latest Canvas 1.x | 1.10.1 |
| Headless module | `canvas_headless` (hidden, experimental) |
| Module dependencies | `simple_oauth >=6.1.0`, `consumers`, `custom_elements` |
| Config object | `canvas_headless.settings` (simple config: `frontends`, `assertion_expiration`) |
| Node requirement | `>=22.19.0 <23` or `>=24.5.0` |
| Frontend port | 3000 |
| CLI env vars | `CANVAS_SITE_URL`, `CANVAS_CLIENT_ID`, `CANVAS_CLIENT_SECRET` |
| Acquia env variable | `AH_SITE_ENVIRONMENT` (`dev`, `test`, `prod`, `ode<N>`) |

### Reference

- [Drupal Canvas](https://www.drupal.org/project/canvas)
- [Canvas headless templates](https://github.com/drupal-canvas/headless-templates)
- [`canvas_headless` README](https://git.drupalcode.org/project/canvas/-/tree/1.x/modules/canvas_headless)
- [`canvas_oauth` setup](https://git.drupalcode.org/project/canvas/-/tree/1.x/modules/canvas_oauth)
- [Config Split](https://www.drupal.org/project/config_split)
- [Acquia Front End Hosting - Advanced](https://docs.acquia.com/acquia-cloud-platform/add-ons/node-js/front-end-hosting-advanced)
- [Node.js on Cloud Platform: getting started](https://docs.acquia.com/acquia-cloud-platform/add-ons/node-js/getting-started)
