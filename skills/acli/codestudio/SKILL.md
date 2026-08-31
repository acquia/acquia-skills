---
name: codestudio
description: "Use when setting up a new Code Studio (GitLab CI/CD) project, changing PHP version in Code Studio builds. NOT for checking pipeline job status — use pipelines-cli-pipeline-operations for that."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: ci-cd
    platform: "ACE (Acquia Cloud Enterprise)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, code-studio, gitlab, ci-cd"
    software_requirements: "acli>=2.x"
---

# Code Studio with Acquia CLI

> **Platform:** This skill applies to **ACE (Acquia Cloud Enterprise)** subscriptions only.

Use when:
- Setting up a new Code Studio project for a Cloud application
- Changing the PHP version used in Code Studio builds
- Migrating an existing `acquia-pipelines.yml` to a `.gitlab-ci.yml` file

> **Note:** This skill covers Code Studio *setup* only. To trigger builds, check job status, or stream logs, use **pipelines-cli** (`pipelines-cli-pipeline-operations`).

Code Studio is Acquia's GitLab-based CI/CD platform. It runs build pipelines, automated tests, and deployments for your Cloud Platform applications.

---

## Set Up Code Studio (Wizard)

The wizard creates and configures a Code Studio project for your application:

```bash
acli codestudio:wizard
```

Alias: `acli cs:wizard`

The wizard will:
1. Authenticate with your Cloud Platform application
2. Connect to your GitLab instance
3. Create or configure a Code Studio project
4. Set up CI/CD variables

**Non-interactive (provide all credentials upfront):**

```bash
acli codestudio:wizard \
  --key="$ACQUIA_KEY" \
  --secret="$ACQUIA_SECRET" \
  --gitlab-token="$GITLAB_TOKEN" \
  --gitlab-project-id=12345 \
  --gitlab-host-name=code.acquia.com
```

> **Security:** Never pass credential values directly in the command line — they appear in shell history and process listings. Always source them from environment variables or a secrets manager.

Options:

| Option | Description |
|---|---|
| `--key` | Cloud Platform API key for Code Studio to use |
| `--secret` | Cloud Platform API secret for Code Studio to use |
| `--gitlab-token` | GitLab personal access token |
| `--gitlab-project-id` | Integer project ID of the GitLab project to configure |
| `--gitlab-host-name` | GitLab hostname (defaults to Acquia's instance) |

---

## Change PHP Version in Code Studio

Update the PHP version used in Code Studio build containers:

```bash
acli codestudio:php-version <version>
```

Example:

```bash
acli codestudio:php-version 8.2
acli codestudio:php-version 8.3
```


## Typical Workflow: Onboard to Code Studio

```bash
# Step 1: Set up Code Studio project
acli codestudio:wizard

# Step 2: Set PHP version if needed
acli codestudio:php-version 8.2
```

---

## Best Practices

1. **Run the wizard first** — It sets up all required CI/CD variables automatically.
2. **Use environment variables for credentials in CI** — Pass `--key`, `--secret`, and `--gitlab-token` via environment variables (e.g., `--key="$ACQUIA_KEY"`), never as literal values. Store secrets in your CI/CD platform's secret store.
3. **Match PHP versions** — Ensure `codestudio:php-version` matches the version in your `composer.json` platform requirements.

---

## Troubleshooting

### "GitLab project not found"

Verify the project ID and that your token has access:

```bash
# Re-run wizard interactively to select the right project
acli codestudio:wizard
```

### Authentication errors

Ensure your Cloud API key/secret are valid:

```bash
acli auth:login
acli auth:me
```

---

## Related Topics

- **[Getting Started](../getting-started/SKILL.md)** — Authentication setup
- **[Environment Management](../environment-management/SKILL.md)** — Deploy to environments
- **[Pull & Push](../pull-push/SKILL.md)** — Push build artifacts
