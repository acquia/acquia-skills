---
name: troubleshooting
description: "Use when acli commands fail, return unexpected errors, authentication breaks, or the CLI behaves unexpectedly."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: troubleshooting
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, troubleshooting, errors, authentication"
    software_requirements: "acli>=2.x"
---

# Troubleshooting Acquia CLI

Use when:
- Diagnosing acli authentication failures
- Resolving command errors or unexpected output
- Collecting information before contacting support

---

## General Issues

### "Command not found: acli"

**Cause:** The binary isn't in your system PATH.

**Solutions:**

```bash
# Check if it's installed
which acli

# If nothing, add to PATH
export PATH="/usr/local/bin:$PATH"

# Test
acli --version

# Make permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### "Permission denied" when running acli

**Cause:** The binary isn't executable.

**Solution:**

```bash
chmod +x /usr/local/bin/acli
acli --version
```

### "acli: command not found" after updating

**Cause:** Update didn't complete or PATH changed.

**Solution:**

```bash
# Reinstall
curl -fsSL https://github.com/acquia/cli/releases/latest/download/acli \
  -o /usr/local/bin/acli
chmod +x /usr/local/bin/acli

# Verify
acli --version
```

---

## Authentication Issues

### "Error: Failed to authenticate"

**Cause:** Your authentication token expired or isn't valid.

**Solution:**

```bash
# Re-authenticate
acli auth:login

# This opens your browser to authorize again
```

### "Error: Access Denied"

**Cause:** Your account doesn't have permission to access the resource.

**Solutions:**

1. **Check you're logged in with the right account:**
   ```bash
   acli auth:me
   ```

2. **Verify you have access in Acquia Cloud UI:**
   - Go to https://cloud.acquia.com
   - Check if you can see the application or resource

3. **Log out and back in:**
   ```bash
   acli auth:logout
   acli auth:login
   ```

### "Invalid JSON in credentials.json"

**Cause:** Credentials file is corrupted.

**Solution:**

```bash
# Remove the corrupted file
rm -rf ~/.acquia/cloud_api/

# Re-authenticate
acli auth:login
```

---

## IDE Issues

### IDE won't start

**Symptoms:** IDE shows "Starting..." indefinitely or won't load.

**Solutions:**

1. **Try restarting IDE services:**
   ```bash
   acli ide:service-stop
   acli ide:service-start
   ```

2. **Check IDE status:**
   ```bash
   acli ide:info
   ```

3. **Wait if newly created:**
   New IDEs take 2-3 minutes to start. Check again in a minute.

4. **Try creating a new IDE:**
   ```bash
   acli ide:create
   ```

### IDE is very slow

**Causes:** Hibernation waking, stuck processes, or resource limits

**Solutions:**

1. **Wait if waking from hibernation:**
   IDEs waking take 30-60 seconds. Be patient.

2. **Clear Drupal caches:**
   ```bash
   acli remote:drush cr
   ```

3. **Restart IDE:**
   ```bash
   acli ide:service-restart
   ```

4. **Create a fresh IDE:**
   ```bash
   acli ide:create --label "Fresh IDE"
   ```

### "Access Denied" when opening IDE

**Cause:** Your SSH key isn't set up.

**Solution:**

```bash
# Create an SSH key
acli ssh-key:create

# Try accessing IDE again
acli ide:open
```

### IDE appears deleted but still exists

**Cause:** The IDE is hibernated or the listing is cached.

**Solution:**

```bash
# Clear cache and list again
acli self:clear-caches
acli ide:list
```

---

## SSH Key Issues

### "Permission denied (publickey)"

**Cause:** SSH key isn't set up or not used correctly.

**Solutions:**

1. **Verify SSH key exists:**
   ```bash
   ls -la ~/.ssh/id_rsa
   ```

2. **If not, create one:**
   ```bash
   acli ssh-key:create
   ```

3. **Check permissions (must be 600):**
   ```bash
   chmod 600 ~/.ssh/id_rsa
   ```

4. **Verify key is added to Acquia account:**
   ```bash
   acli ssh-key:list
   ```

### "SSH key not found when creating IDE"

**Cause:** IDE creation requires an SSH key for secure access.

**Solution:**

```bash
# Create SSH key first
acli ssh-key:create

# Then create IDE
acli ide:create
```

### "Multiple SSH keys - which one to use?"

**Solution:**

Add to `~/.ssh/config`:

```
Host ide-*.ides.acquia.com
  IdentityFile ~/.ssh/my_custom_key
```

---

## Application & Environment Issues

### "No applications found"

**Cause:** You don't have access to any applications yet.

**Solutions:**

1. **Check if you're in a team:**
   ```bash
   acli auth:me
   ```

2. **Ask your team admin** to add you to an application

### "Error: Application not found"

**Cause:** Wrong application UUID or no access.

**Solutions:**

1. **List applications to find the right one:**
   ```bash
   acli api:applications:list
   ```
   > **MEO (V3) subscriptions:** `api:applications:list` returns nothing — list your resources with
   > `acli api:v3:sites:list` or `acli api:v3:codebases:list` instead (see [MEO Overview](../meo-overview/SKILL.md)).

2. **Use the correct application:**
   ```bash
   acli ide:create --application=<correct-uuid>
   ```

---

## Command Execution Issues

### "Error: Drush command failed"

**Cause:** Drush error in your Drupal site.

**Solutions:**

1. **Check Drush output for details:**
   ```bash
   acli remote:drush status
   ```

2. **Clear caches:**
   ```bash
   acli remote:drush cr
   ```

### "Error: Could not connect to remote server"

**Cause:** Network connectivity or SSH key issue.

**Solutions:**

1. **Check SSH key setup:**
   ```bash
   acli ssh-key:list
   ```

2. **Try verbose output for details:**
   ```bash
   acli -vvv <command>
   ```

---

## Performance Issues

### Commands taking too long

**Solutions:**

1. **Try again** (might be temporary)

2. **Check internet connection:**
   ```bash
   ping acquia.com
   ```

3. **Try with shorter timeout:**
   ```bash
   acli <command> --no-wait
   ```

### Cache causing stale data

**Cause:** CLI caches API responses.

**Solutions:**

```bash
# Clear cache
acli self:clear-caches   # aliases: acli cc, acli cr

# Try the command again
acli <command>

# Or run with --no-cache if supported
acli <command> --no-cache
```

---

## Getting Help

### Check your acli version

```bash
acli --version
```

### Enable debug output

```bash
# Run any command with verbose output
acli -vvv <command>

# Save to a log file
acli -vvv <command> > debug.log 2>&1
```

### View all help

```bash
# General help
acli --help

# List all commands
acli list

# Help for a specific command
acli <command> --help
```

---

## Getting Help from Support

### Before contacting support, gather info

```bash
# Your version
acli --version

# Your account info
acli auth:me

# Your applications (ACE / V2). On MEO (V3), use: acli api:v3:sites:list
acli api:applications:list

# Your IDEs
acli ide:list

# Your SSH keys
acli ssh-key:list

# Debug output of the problem command
acli -vvv <command> 2>&1 | tee debug.log
```

### Contact Acquia Support

- **Support Portal:** https://acquia.my.site.com/s/
- **GitHub Issues:** https://github.com/acquia/cli/issues
- **Discussions:** https://github.com/acquia/cli/discussions

---

## Common Error Messages

| Error | Meaning | Solution |
|---|---|---|
| "Error: Access Denied" | You don't have permission | Check account access, team membership |
| "Command not found" | Binary not in PATH | Check installation, verify PATH |
| "Failed to authenticate" | Token expired or invalid | Re-run `acli auth:login` |
| "SSH Key not found" | IDE needs SSH key | Create key with `acli ssh-key:create` |
| "IDE not starting" | IDE provisioning slow or failed | Wait 2-3 min, restart, or create new |
| "Permission denied (publickey)" | SSH key issue | Verify key setup: `acli ssh-key:list` |
| "No applications found" | No team access | Ask admin to add you to team |

---

## Advanced Troubleshooting

### Check API responses

```bash
# See what the API is returning
acli -vvv <command> 2>&1 | grep -A 5 "Response:"
```

### Reset all configuration

```bash
# CAUTION: This clears everything
rm -rf ~/.acquia

# Re-authenticate
acli auth:login
```

## Best Practices

1. **Stay updated** — Run `acli self:update` regularly; many errors are fixed in newer versions.
2. **Check authentication first** — Run `acli auth:me` before blaming other commands.
3. **Use verbose mode** — Add `-vvv` to any failing command to see detailed error output.

---

**Still stuck?** [Contact Acquia Support](https://acquia.my.site.com/s/)
