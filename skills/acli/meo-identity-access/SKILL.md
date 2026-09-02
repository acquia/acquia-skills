---
name: meo-identity-access
description: "Use when managing MEO federated authentication: SSO domains, identity providers, and SSO policies. Enables customers to configure SAML-based single sign-on for their MEO subscription."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: security
    platform: "MEO (Multi-site Enterprise Operations)"
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, meo, v3, sso, identity-providers, saml, federated-auth"
    software_requirements: "acli>=2.x"
---

# MEO Identity & Access Management

> **Platform:** This skill applies to **MEO (Multi-site Enterprise Operations)** subscriptions only.
> These are [development-stability] commands and may change without notice.

Use when:
- Setting up federated SSO (SAML) for a MEO subscription
- Managing SSO domains: adding, verifying, or removing domains
- Configuring identity providers (IdPs) and their SSO policies
- Enabling or disabling SSO enforcement

**Note:** All commands use `acli api:v3:*`. Run `acli list api:v3:identity-providers` and `acli list api:v3:sso-domains` to see all current commands.

---

## SSO Domains

SSO domains are the email domains that will be enrolled for federated login (e.g. `example.com` means all `@example.com` users are redirected to the IdP).

```bash
# List all accessible SSO domains
acli api:v3:sso-domains:list

# Get details for a specific domain
acli api:v3:sso-domains:find <domainId>

# List SSO domains for a subscription
acli api:v3:subscriptions:list-sso-domains <subscriptionId>

# Create (register) a new SSO domain for a subscription
acli api:v3:subscriptions:create-sso-domain <subscriptionId>
```

### Verify Domain Ownership

Before enforcing SSO, prove you own the domain via a DNS TXT record:

```bash
acli api:v3:sso-domains:verify <domainId>
```

The command returns the TXT record value to add to your DNS. Run the command again after DNS propagation to confirm verification.

### Delete an SSO Domain

> **Destructive operation — explicit approval required.**
> Removes the domain from SSO enrollment. Users with that email domain will lose SSO access. Confirm with the user before executing.

```bash
acli api:v3:sso-domains:delete <domainId>
```

---

## Identity Providers

An identity provider (IdP) is the SAML endpoint that authenticates your users (e.g. Okta, Azure AD, ADFS).

```bash
# List all accessible identity providers
acli api:v3:identity-providers:list

# Get details for a specific IdP
acli api:v3:identity-providers:find <identityProviderId>

# List identity providers for a subscription
acli api:v3:subscriptions:list-identity-providers <subscriptionId>

# Create an identity provider for a subscription
acli api:v3:subscriptions:create-identity-provider <subscriptionId>
```

### Update an Identity Provider

```bash
acli api:v3:identity-providers:update <identityProviderId> \
  --label="My Okta IdP" \
  --sso_url="https://myorg.okta.com/app/sso/saml" \
  --idp_entity_id="https://myorg.okta.com" \
  --certificate="<x509-cert-contents>"
```

### Delete an Identity Provider

> **Destructive operation — explicit approval required.**
> Permanently removes the identity provider. Any SSO policies referencing it will stop working. Confirm with the user before executing.

```bash
acli api:v3:identity-providers:delete <identityProviderId>
```

---

## SSO Policies

An SSO policy links an identity provider to one or more verified domains to enforce federated login.

```bash
# Get the SSO policy for an IdP
acli api:v3:identity-providers:find-sso-policy <identityProviderId>

# Create a policy (requires verified domain IDs)
acli api:v3:identity-providers:create-sso-policy <identityProviderId> <domain_ids>

# Update the domains in a policy
acli api:v3:identity-providers:update-sso-policy <identityProviderId> <domain_ids>
```

`domain_ids` is a space-separated list of verified SSO domain UUIDs.

### Enable or Disable an SSO Policy

```bash
# Enable — starts enforcing SSO for the configured domains
acli api:v3:identity-providers:enable-sso-policy <identityProviderId>

# Disable — SSO enforcement paused; users can log in with passwords
acli api:v3:identity-providers:disable-sso-policy <identityProviderId>
```

### Delete an SSO Policy

> **Destructive operation — explicit approval required.**
> Removing the SSO policy disables federated login enforcement for all associated domains. Confirm with the user before executing.

```bash
acli api:v3:identity-providers:delete-sso-policy <identityProviderId>
```

---

## Typical Workflows

### Set up SSO for a subscription (end-to-end)

```bash
# 1. Register your email domain
acli api:v3:subscriptions:create-sso-domain <subscriptionId>
# Returns a domainId

# 2. Verify domain ownership via DNS TXT record
acli api:v3:sso-domains:verify <domainId>
# Follow DNS instructions, then re-run once DNS propagates

# 3. Create the identity provider (your SAML IdP)
acli api:v3:subscriptions:create-identity-provider <subscriptionId>
# Fill in certificate, SSO URL, entity ID when prompted

# 4. Create an SSO policy linking the IdP to the verified domain
acli api:v3:identity-providers:create-sso-policy <identityProviderId> <domainId>

# 5. Enable the policy
acli api:v3:identity-providers:enable-sso-policy <identityProviderId>
```

### Temporarily disable SSO (for emergency access)

```bash
acli api:v3:identity-providers:disable-sso-policy <identityProviderId>
# ... resolve IdP issue ...
acli api:v3:identity-providers:enable-sso-policy <identityProviderId>
```

---

## Discover More Commands

```bash
acli list api:v3:sso-domains
acli list api:v3:identity-providers
acli list api:v3:subscriptions
acli api:v3:identity-providers:create-sso-policy --help
```

---

## Related Topics

- **[MEO Overview](../meo-overview/SKILL.md)** — ACE vs MEO, data model
- **[MEO CDN & Security](../meo-cdn-security/SKILL.md)** — IP rules, security rulesets, rate limiting
