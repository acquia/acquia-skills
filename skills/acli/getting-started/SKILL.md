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

**Which option:**
1. PHP 8.2+ installed (`php --version`) → Option 2 (PHAR).
2. Otherwise, Apple silicon Mac or Linux x86_64 → Option 1 (native).
3. Otherwise (e.g. Intel Mac without PHP), there's no native build. Tell the user they need
   PHP 8.2+ for the PHAR, and let them decide how to install it.
4. If the download fails with a TLS/certificate error, try the other option **once**. If that
   fails too, stop and see [TLS / certificate errors](../troubleshooting/SKILL.md#tls--certificate-errors-during-download).

Don't install Homebrew just to get acli.

#### Option 1: Native Binary (no PHP needed)

```bash
mkdir -p ~/.local/bin
# Apple silicon Mac. On Linux x86_64 use native-acli-linux-x86_64.tar.gz
curl -fsSL https://github.com/acquia/cli/releases/latest/download/native-acli-macos-aarch64.tar.gz \
  | tar -xz -C ~/.local/bin acli
chmod +x ~/.local/bin/acli
export PATH="$HOME/.local/bin:$PATH"
acli --version
```

#### Option 2: PHP Archive (PHAR, needs PHP 8.2+)

```bash
mkdir -p ~/.local/bin
curl -fsSL https://github.com/acquia/cli/releases/latest/download/acli.phar \
  -o ~/.local/bin/acli
chmod +x ~/.local/bin/acli
export PATH="$HOME/.local/bin:$PATH"
acli --version
```

Add the `export PATH=...` line to `~/.zshrc` / `~/.bashrc` to keep it across shells.

#### Already have an older acli?

Trial commands need 4.3+. If the old copy is root-owned (e.g. `/usr/local/bin/acli`), don't
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
  device code without a terminal, use `yes | acli auth:login` (it also answers the
  first-run telemetry question with its default, yes).
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

acli collects anonymous usage data by default. Agents must not disable it on the user's
behalf; only the user decides. To opt out:

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
