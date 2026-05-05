---
name: identity-providers
description: "Use when configuring SSO/SAML identity providers for Acquia Cloud organizations, enabling or disabling federated authentication."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: access-management
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, sso, saml, identity-provider, authentication"
    software_requirements: "acli>=2.x"
---

# Identity Providers (SSO) with Acquia CLI

Use when:
- Configuring a SAML or OIDC identity provider for your organization
- Enabling or disabling federated SSO login
- Updating IdP metadata or settings
- Listing or deleting existing identity provider configurations

Identity providers (IdPs) allow your organization's users to log in to Acquia Cloud using your corporate SSO (e.g., Okta, Azure AD, Google Workspace).

---

## List Identity Providers

```bash
acli api:identity-providers:find
```

Returns all configured identity providers for your organization.

---

## Enable an Identity Provider

```bash
acli api:identity-providers:enable <identityProviderUuid>
```

Once enabled, users can log in via SSO. Existing password-based accounts continue to work unless enforcement is configured.

---

## Disable an Identity Provider

```bash
acli api:identity-providers:disable <identityProviderUuid>
```

Disabling reverts to standard Acquia Cloud password login for all users.

---

## Update Identity Provider Settings

Update the IdP configuration (e.g., new metadata URL, updated certificates):

```bash
acli api:identity-providers:update <identityProviderUuid> \
  --metadata-url=https://idp.example.com/saml/metadata \
  --label="Okta SSO"
```

---

## Delete an Identity Provider

```bash
acli api:identity-providers:delete <identityProviderUuid>
```

> **Warning:** Deleting an active IdP locks out users who only have SSO access. Ensure fallback admin accounts exist before deleting.

---

## Typical Workflow: Onboard a New IdP

```bash
# Step 1 — Configure the IdP in the Acquia Cloud UI (or via API call),
#           obtaining the identityProviderUuid.

# Step 2 — Verify the configuration
acli api:identity-providers:find

# Step 3 — Enable SSO
acli api:identity-providers:enable <identityProviderUuid>

# Step 4 — Test with a non-admin account before enforcing
```

---

## Best Practices

1. **Keep a break-glass admin account** — Maintain at least one Acquia Cloud account with password login in case the IdP goes down.
2. **Test before enforcing** — Enable SSO and test with a subset of users before making it mandatory.
3. **Update metadata promptly** — When your IdP rotates certificates, update the configuration immediately to avoid login failures.

---

## Related Topics

- **[Org and Team Management](../org-team-management/SKILL.md)** — Assign team roles after SSO users log in
- **[Subscriptions](../subscriptions/SKILL.md)** — Shield ACL for additional IP-level access control
- **[Getting Started](../getting-started/SKILL.md)** — Authentication baseline
