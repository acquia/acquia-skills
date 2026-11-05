---
name: getting-started
description: "Use when acli is not installed, authentication fails, or user needs to install and authenticate acli for the first time."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: onboarding
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, cli, installation, authentication"
    software_requirements: "acli>=2.x"
---

# Getting Started with Acquia CLI

This guide covers installation, authentication, and your first commands.

Use when:
- Installing acli for the first time
- Authenticating with Acquia Cloud
- Learning your first acli commands

## Tool Overview

Two separate CLIs exist for Acquia Cloud operations:

| Tool | Purpose |
|---|---|
| `acli` | General Cloud management: applications, environments, IDEs, SSH keys, code/DB sync |
| `pipelines-cli` | CI/CD pipeline operations: trigger builds, check job status, stream logs |

Use **pipelines-cli** for anything related to pipeline jobs. Use **acli** for everything else.

### ACE vs MEO

`acli` serves two distinct hosting products with separate command prefixes:

| Product | Command prefix | API |
|---|---|---|
| **ACE** (Acquia Cloud Enterprise) — classic single-site hosting | `acli api:*` | V2 |
| **MEO** (Multi-site Enterprise Operations) — multi-site hosting | `acli api:v3:*` | V3 |

If you're working on a MEO subscription, see **[MEO Overview](../meo-overview/SKILL.md)** for the full command set.

---

## Installation

### macOS & Linux

Install into `~/.local/bin` (no `sudo`). Downloads come from `github.com` and
`release-assets.githubusercontent.com`.

**Before installing:** run `command -v acli && acli --version`. The Atlassian CLI is also
named `acli`. If the output is not `Acquia CLI`, don't overwrite or shadow it: install Acquia
CLI into its own directory (`~/.local/acquia-cli/bin`, the `<dir>` below), call it by its full
path, and skip the `PATH` steps. Otherwise `<dir>` is `~/.local/bin`.

**Which option:**
1. Apple silicon Mac or Linux x86_64 → Option 1 (native). Prefer it even when PHP is
   installed: it needs no PHP and its JSON output can't be broken by PHP deprecation notices.
2. Otherwise (e.g. Intel Mac), there's no native build. With PHP 8.2+ and the curl, json and
   openssl extensions (`php --version`) → Option 2 (PHAR). Without it, tell the user they need
   PHP 8.2+ for the PHAR, and let them decide how to install it.
3. If the download or the first `acli` command fails with a TLS/certificate error (such as
   `unable to get local issuer certificate`), a corporate proxy is intercepting HTTPS. Switch to
   the other option **once**, if this machine has one. If that fails too, **stop** and tell the
   user their network's TLS inspection is blocking the download. Don't try CA bundle or `.ini`
   overrides yourself. See
   [TLS / certificate errors](../troubleshooting/SKILL.md#tls--certificate-errors-during-download).

Don't install Homebrew just to get acli.

**Verify before running.** Download the file under its release name, next to the release's
`SHA256SUMS`, and check it before you extract, rename or run it. The check must print
`<file>: OK`; `no file was verified` means the name didn't match and nothing was checked. Don't
run a file that fails. This is mandatory when an agent, not a person, does the install.

#### Option 1: Native Binary (no PHP needed)

```bash
file=native-acli-macos-aarch64.tar.gz    # Linux x86_64: native-acli-linux-x86_64.tar.gz
dir=~/.local/bin                         # see "Before installing"
tmp=$(mktemp -d) && cd "$tmp"
curl -fsSLO "https://github.com/acquia/cli/releases/latest/download/$file"
curl -fsSLO https://github.com/acquia/cli/releases/latest/download/SHA256SUMS
shasum -a 256 --check --ignore-missing SHA256SUMS    # Linux: sha256sum --check --ignore-missing SHA256SUMS
tar -xzf "$file" acli
mkdir -p "$dir" && chmod +x acli && mv acli "$dir/acli"
"$dir/acli" --version
```

#### Option 2: PHP Archive (PHAR, needs PHP 8.2+)

```bash
dir=~/.local/bin                         # see "Before installing"
tmp=$(mktemp -d) && cd "$tmp"
curl -fsSLO https://github.com/acquia/cli/releases/latest/download/acli.phar
curl -fsSLO https://github.com/acquia/cli/releases/latest/download/SHA256SUMS
shasum -a 256 --check --ignore-missing SHA256SUMS    # Linux: sha256sum --check --ignore-missing SHA256SUMS
mkdir -p "$dir" && chmod +x acli.phar && mv acli.phar "$dir/acli"
"$dir/acli" --version
```

When `<dir>` is `~/.local/bin` and it isn't on your `PATH` yet, add
`export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` / `~/.bashrc`. Don't do this for the
Atlassian CLI case: it would hide whichever `acli` comes second.

#### Already have an older acli?

Trial commands need 4.3.1+ (4.3.0 lists them but its device code sign-in isn't configured). If the old copy is root-owned (e.g. `/usr/local/bin/acli`), don't
overwrite it or use `sudo`: install into `~/.local/bin` as above, put it first on `PATH`, and
check that `command -v acli` prints `~/.local/bin/acli`. A user-writable install can run
`acli self:update` instead.

---

## Your First Command: Authentication

```bash
acli auth:login
```

What happens depends on what's already on your machine:

- **No stored credentials** — ACLI starts a device code sign-in: it prints a short URL and a
  code, opens your browser automatically if one is available, and waits while you approve the
  sign-in there. Your organization's SSO/MFA policy applies, same as signing in anywhere else.
  No key or secret to copy-paste.
- **An API key already active** — ACLI reports it and asks whether you'd rather sign in with
  device code instead (default: no). Say no to keep using the existing key. With
  `--no-interaction` it takes the `no` and then fails asking for a key and secret. To get
  device code without a terminal, answer the prompt with one piped `y` (see
  [Agents and scripts](#agents-and-scripts)). Don't pipe `yes` into `acli auth:login`: if
  device code fails it answers the API key fallback prompts too, loops forever on
  `Value "y" is invalid`, and can open a browser on the user's machine.
- **A device code session already active** — ACLI reports you're already signed in and asks
  whether to re-authenticate. Say no to leave the existing session alone and exit immediately.
- **`acli auth:login --use-legacy-auth`** (or passing `--key`/`--secret` directly) — always
  goes straight to the classic API key + secret flow, generated from Acquia Cloud UI under
  Settings → API Tokens.

Credentials are stored locally in `cloud_api.conf` in ACLI's config directory — `~/.acquia/`
if that directory already exists on your machine, otherwise `$XDG_CONFIG_HOME/acquia/` or
`~/.config/acquia/` on a fresh install. Set `ACLI_HOME` to override this directory explicitly
(useful if both exist and you need to pick one). A device code session refreshes itself
silently in the background while you're using acli regularly; if you haven't run acli in a
while and a command reports your session has expired, just run `acli auth:login` again.

### Agents and scripts

- Pass `-n` (`--no-interaction`) on every `acli` command except `auth:login`, so nothing blocks
  on a prompt.
- `acli api:*` commands print JSON on stdout; `-n` doesn't change that. Other commands print
  human-formatted output. Read stdout only, and skip anything before the first `{` or `[`.
- To start device code sign-in when credentials are already stored:

  ```bash
  # Run in the background; read the activation URL and code.
  printf 'y\n' | ACLI_NO_TELEMETRY=true SHELL_INTERACTIVE=1 acli auth:login
  ```

  Put `ACLI_NO_TELEMETRY=true` on the command itself, not in a separate `export`: many agent
  shells drop exports between commands, and without it a first-run telemetry question would
  take the piped `y` and record "yes" to sharing usage data.

  Don't pass `-n` here, and don't run it with nothing piped: either way acli takes the default
  `no`, opens the API token page in the user's browser, and exits asking for a key.
  `SHELL_INTERACTIVE=1` makes acli treat an agent's shell, which has no terminal, as
  interactive, so the single piped `y` answers `Sign in with device code instead?` (API key
  stored) or `Re-authenticate?` (device session stored). With nothing stored there is no
  prompt and the `y` is unused. Switching to device code deactivates the stored API key: acli keeps it in the config file but stops using it, and only `acli auth:login --use-legacy-auth` makes it active again. Scripts that rely on that key stop authenticating, so tell the user before you sign in this way. Pipe exactly one
  `y`: never pipe `yes`, which loops forever on the API key fallback prompts if device code
  fails.

### Log Out

```bash
acli auth:logout
```

Removes whichever credentials are active (device token, API key, or both) from
`cloud_api.conf`. Add `--delete` to also forget a stored API key entirely instead of just
deactivating it.

### Verify Authentication

```bash
acli api:accounts:find
```

Shows your name, email, and account information.

---

## Your First Command: List Applications

See which applications you have access to:

```bash
acli api:applications:list
```

Output:
```
Select a Cloud Platform application:
  [0] My First App (prod, staging, dev)
  [1] Client Project (prod, staging)
  [2] Development App (dev)
```

---

## Shell Completion

Enable tab completion for faster command entry.

### Bash

```bash
eval "$(acli shell:complete bash)"
```

Add to `~/.bashrc` for permanent setup:

```bash
echo 'eval "$(acli shell:complete bash)"' >> ~/.bashrc
source ~/.bashrc
```

### Zsh

```bash
eval "$(acli shell:complete zsh)"
```

Add to `~/.zshrc`:

```bash
echo 'eval "$(acli shell:complete zsh)"' >> ~/.zshrc
source ~/.zshrc
```

### Fish

```bash
acli shell:complete fish | source
```

Add to `~/.config/fish/config.fish`:

```bash
acli shell:complete fish | source
```

---

## Getting Help

### Command Help

Every command has a built-in help page:

```bash
# General help
acli --help
acli -h

# Help for a specific command
acli ide:create --help
acli ide:create -h

# List all available commands by category
acli list
```

### Verbose Output

For debugging, show detailed output:

```bash
# -v (normal), -vv (detailed), -vvv (very detailed)
acli ide:list -vvv
acli ide:create -v
```

### Debug Mode

Run any command in debug mode to see behind-the-scenes details:

```bash
acli ide:create --debug
```

---

## Configuration

### Config File Location

Configuration is stored in ACLI's config directory: `~/.acquia/` if that directory already
exists on your machine (legacy installs), otherwise `$XDG_CONFIG_HOME/acquia/` or
`~/.config/acquia/` on a fresh install. Override with `ACLI_HOME` to point at a specific
directory explicitly.

```
<config dir>/
├── cloud_api.conf             # Credentials: device token and/or API key + secret
├── config.yaml                # Settings
└── cache/                      # Cached data
```

### Linking a Local Project

Run `acli app:link` in your project directory to associate it with a Cloud application. See **[Application Management](../application-management/SKILL.md)** for details.

---

## Common First Steps

### Step 1: Authenticate

```bash
acli auth:login
acli api:accounts:find
```

### Step 2: Set Up a Project

```bash
cd /path/to/project
acli app:link
```

### Step 3: Create an IDE (or connect to existing)

```bash
acli ide:create    # Create a new one
# OR
acli ide:list      # Connect to existing
```

### Step 4: Set Up SSH

```bash
acli ssh-key:list   # See your SSH keys
# If no keys, create one
acli ssh-key:create
```

### Step 5: Try a Drush Command

```bash
acli remote:drush status
acli remote:drush cr   # Clear caches
```

---

## Troubleshooting

### "Command not found: acli"

Make sure the binary is in your `PATH`. Try:

```bash
which acli
# If nothing, add to PATH
export PATH="/usr/local/bin:$PATH"
acli --version
```

### "Error: Failed to authenticate"

Your token has expired or isn't valid. Try:

```bash
acli auth:login
```

### "Error: Access denied"

You don't have permission to access that application or resource. Check:
- Are you logged in with the right Acquia account?
- Do you have permissions in Acquia Cloud UI?

Run `acli api:accounts:find` to verify you're using the right account.

### Need more help?

See [Troubleshooting Guide](../troubleshooting/SKILL.md) for more issues.

---

## Acquia Site Factory (ACSF) Authentication

If your organization uses Acquia Site Factory, register separate credentials:

```bash
acli auth:acsf-login
```

Options:

```bash
acli auth:acsf-login \
  --username=myuser \
  --key=MY_API_KEY \
  --factory-url=https://www.myfactory.com
```

To log out:

```bash
acli auth:acsf-logout
```

---

## Cache Management

Clear local acli caches (useful when commands behave unexpectedly):

```bash
acli self:clear-caches
```

Aliases: `acli cc`, `acli cr`

---

## Telemetry

acli collects anonymous usage data by default. Only the user decides. To opt out:

```bash
acli self:telemetry:disable
```

To re-enable:

```bash
acli self:telemetry:enable
```

Toggle interactively:

```bash
acli self:telemetry:toggle
```

Alias: `acli telemetry`

Setting `ACLI_NO_TELEMETRY=true` in the environment skips both the first-run question and
telemetry itself.

### Agents and scripts (telemetry)

Put `ACLI_NO_TELEMETRY=true` on every `acli` command (`ACLI_NO_TELEMETRY=true acli ...`) until
the user has answered, rather than in one `export`: many agent shells drop exports between
commands. Without a terminal and without that variable, acli can record the default answer
(yes) for the user without asking. With it, acli asks nothing and reports telemetry as off.

- Don't spend a separate question on it. Fold it into the first question the flow already
  asks, as its own part with two options and neither marked recommended: "Share anonymous
  usage data" / "Don't share usage data". Declining must lead to the same flow. For a trial,
  that is the usage-data part of the first question in the
  [trial runbook](https://dev.acquia.com/agents/cloud-platform-trial.md). Never present it as a
  mention or an instruction to run a command.
- When they answer, record it yourself:

  ```bash
  ACLI_NO_TELEMETRY=true acli self:telemetry:enable --no-interaction    # share
  ACLI_NO_TELEMETRY=true acli self:telemetry:disable --no-interaction   # don't share
  ```

  After "share", stop adding `ACLI_NO_TELEMETRY=true`, so the choice applies to the rest of
  the session; with the answer stored, acli asks nothing more. After "don't share", keep it on
  every command.
- If they don't answer, leave telemetry off and tell them they'll be asked the next time they
  run acli themselves.

---

## Open Product Documentation

Open Acquia product docs in your browser:

```bash
acli docs
```

For a specific product:

```bash
acli docs acli
acli docs cloud-ide
```

---

## Best Practices

1. **Authenticate first** — Run `acli auth:login` before anything else; most commands require it.
2. **Discover commands** — Use `acli list` to see all available commands grouped by topic.
3. **Enable shell completion** — Run `acli shell:complete` once to get tab-completion for commands and flags.
4. **Verify your setup** — Run `acli self:info` to confirm your authenticated identity and acli version.
5. **Stay updated** — Run `acli self:update` regularly to get bug fixes and new features.
6. **Clear caches on odd behavior** — Run `acli self:clear-caches` if commands return unexpected results.

---

## Next Steps

Now that you're set up, try:

- **[Create your first IDE](../ide-management/SKILL.md)** — Set up a development environment
- **[Explore applications](../application-management/SKILL.md)** — Learn about your apps
- **[Set up SSH keys](../ssh-key-management/SKILL.md)** — Secure authentication
