---
name: ssh-key-management
description: "Use when adding, listing, or deleting SSH keys for Acquia Cloud access, or when SSH access is denied due to missing keys."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: authentication
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, ssh, keys, authentication"
    software_requirements: "acli>=2.x"
---

# Managing SSH Keys

Use when:
- Adding or generating an SSH key for Acquia Cloud
- Listing or deleting SSH keys
- Setting up SSH access for IDEs or CI/CD pipelines

SSH keys provide secure authentication to Acquia Cloud resources without needing to enter passwords.

---

## Why SSH Keys?

SSH keys allow you to:

- **Securely access your IDEs** without entering a password
- **Push code** to your repositories
- **Execute remote commands** on your servers
- **Automate deployments** in scripts or CI/CD pipelines

---

## List Your SSH Keys

### See all your SSH keys

```bash
acli ssh-key:list
```

Output:
```
SSH Keys for your account:
  [0] My Laptop (generated 2024-01-15)
      Fingerprint: ab:cd:ef:12:34:56:78:90
  [1] Work Desktop (generated 2024-02-01)
      Fingerprint: 11:22:33:44:55:66:77:88
```

### List keys per IDE

```bash
acli ide:ssh-key:list
```

---

## Generate a New SSH Key

### Create an SSH key interactively

```bash
acli ssh-key:create
```

This will:

1. Prompt for a label (e.g., "My Laptop", "CI Server")
2. Generate a public/private key pair
3. Store the public key in your Acquia account
4. Save the private key locally (usually `~/.ssh/id_rsa`)

Example:

```bash
$ acli ssh-key:create
? Enter a label for this SSH key: My Laptop
✓ SSH key created!
  Public key added to your account.
  Private key saved to: ~/.ssh/id_rsa
  Fingerprint: ab:cd:ef:12:34:56:78:90
```

> **Note:** The label prompt is the last step before the key is generated and permanently added to your Acquia account. Confirm your label is correct before pressing Enter.

---

## Upload an Existing SSH Key

If you already have an SSH key, upload it without regenerating:

```bash
acli ssh-key:upload --filepath ~/.ssh/id_rsa.pub --label "Existing Key"
```

Or interactively:

```bash
acli ssh-key:upload
```

Prompts you to select the key file and enter a label.

### Skip waiting for propagation

By default, acli waits for the key to propagate to all servers. Skip this with:

```bash
acli ssh-key:upload --filepath ~/.ssh/id_rsa.pub --label "My Key" --no-wait
```

---

## Create and Upload in One Step

Generate a new key locally and upload it to Cloud Platform in a single command:

```bash
acli ssh-key:create-upload
```

Options:

```bash
acli ssh-key:create-upload \
  --filename=my_key \
  --password="" \
  --label="My New Key" \
  --no-wait
```

---

## Inspect an SSH Key

Get details about a specific key by fingerprint:

```bash
acli ssh-key:info --fingerprint="ab:cd:ef:12:34:56:78:90"
```

Useful for confirming which key is registered before deleting.

---

## Delete an SSH Key

### Remove a key from your account

```bash
acli ssh-key:delete
```

Prompts which key to delete:

```
? Select the SSH key to delete: [0] My Laptop
? Delete "My Laptop"? (yes/no)
✓ SSH key deleted.
```

### Non-interactive delete

```bash
acli ssh-key:delete --public-key "ab:cd:ef:12:34:56:78:90"
```

---

## Using SSH Keys with IDEs

### SSH into your IDE

Once you have an SSH key set up, you can connect to your IDE:

```bash
# Note: Use the IDE ides-hostname, not the web URL
ssh -i ~/.ssh/id_rsa user@ide-12345.ides.acquia.com
```

### Set up git over SSH in your IDE

Instead of using HTTPS (which requires password authentication), use SSH:

```bash
# Configure your IDE's Git to use SSH
git remote set-url origin git@github.com:yourorg/yourrepo.git

# Now push without entering a password
git push origin main
```

### Export public key for other systems

```bash
# Show your public key
cat ~/.ssh/id_rsa.pub

# Copy it to GitLab, GitHub, internal systems, etc.
```

---

## Best Practices

### 1. One Key Per Device

Create separate keys for each machine:

```bash
# Personal laptop
acli ssh-key:create --label "Personal MacBook"

# Work desktop
acli ssh-key:create --label "Work Desktop"

# CI/CD server
acli ssh-key:create --label "Jenkins CI Server"
```

### 2. Use Descriptive Labels

```bash
# ✓ Good
acli ssh-key:create --label "2024 MacBook Pro - Home"
acli ssh-key:create --label "GitHub Actions CI"

# ✗ Bad
acli ssh-key:create --label "Key 1"
```

### 3. Revoke Old Keys

Remove keys you no longer use:

```bash
acli ssh-key:delete
```

### 4. Protect Your Private Key

```bash
# Permissions should be 600 (read/write for owner only)
chmod 600 ~/.ssh/id_rsa
```

### 5. Use SSH Agents

**macOS:**
```bash
# Add to ~/.ssh/config
Host *
  AddKeysToAgent yes
  UseKeychain yes
```

**Linux:**
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa
```

---

## Advanced: SSH for CI/CD

### Generate key for CI/CD pipeline

```bash
acli ssh-key:create --label "GitHub Actions CI"
```

Then:

1. Copy the private key
2. Add it to your CI/CD provider's secrets (GitHub Secrets, GitLab CI/CD Variables, etc.)
3. Use in your CI script

**GitHub Actions example:**

```yaml
- name: Deploy to Acquia
  uses: actions/checkout@v2
  env:
    SSH_KEY: ${{ secrets.ACQUIA_SSH_KEY }}
  run: |
    mkdir -p ~/.ssh
    echo "$SSH_KEY" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    acli api:environments:code-switch <env-id> main
```

> **MEO (V3) subscriptions:** use `acli api:v3:environments:create-deployment <environmentId> true refs/heads/main`
> instead of `api:environments:code-switch` (see [MEO Deployments](../meo-deployments/SKILL.md)).

---

## Related Topics

- **[IDE Management](../ide-management/SKILL.md)** — Use SSH keys to access IDEs
- **[Getting Started](../getting-started/SKILL.md)** — Initial setup
- **[Troubleshooting](../troubleshooting/SKILL.md)**
