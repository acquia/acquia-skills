---
name: private-networks
description: "Use when setting up VPC peering or VPN connections between Acquia Cloud environments and external networks."
license: Proprietary
compatibility: acli>=2.x
metadata:
    category: networking
    author: Acquia
    version: "1.0.0"
    tags: "acli, acquia-cloud, vpc, vpn, private-networks, networking"
    software_requirements: "acli>=2.x"
---

# Private Networks with Acquia CLI

Use when:
- Creating a private network for a subscription
- Setting up VPC peering between Acquia Cloud and your cloud provider
- Configuring a VPN connection to Acquia Cloud environments
- Listing or deleting existing peering or VPN connections

> **Note:** Private Networks is an Acquia add-on feature. Confirm it is enabled on your subscription before running these commands.

---

## Create a Private Network

Before creating VPC peers or VPNs, a private network must exist for your subscription:

```bash
acli api:private-networks:create <subscriptionUuid>
```

---

## VPC Peering

VPC peering connects your cloud provider's VPC (AWS, GCP, Azure) directly to Acquia Cloud, bypassing the public internet.

### Create a VPC peer

```bash
acli api:private-networks:create-vpc-peer <subscriptionUuid> \
  --peer-account-id=<aws-account-id> \
  --peer-vpc-id=<vpc-id> \
  --peer-cidr=10.0.0.0/16 \
  --peer-region=us-east-1
```

### List VPC peers

```bash
acli api:private-networks:list-vpc-peers <subscriptionUuid>
```

### Delete a VPC peer

```bash
acli api:private-networks:delete-vpc-peer <subscriptionUuid> <peerUuid>
```

---

## VPN Configuration

A VPN creates an encrypted tunnel between Acquia Cloud and your on-premises or remote network.

### Create a VPN

```bash
acli api:private-networks:create-vpn <subscriptionUuid> \
  --name="Office VPN" \
  --remote-gateway=203.0.113.1 \
  --remote-cidr=192.168.0.0/24 \
  --local-cidr=10.0.0.0/24
```

---

## List All Private Network Resources

```bash
acli api:private-networks:list <subscriptionUuid>
```

Returns all peering connections and VPN tunnels for the subscription.

---

## Delete a Private Network

```bash
acli api:private-networks:delete <subscriptionUuid>
```

> **Warning:** Deletes all VPC peers and VPN tunnels associated with the private network. Coordinate with your network team before running.

---

## Best Practices

1. **Validate CIDR ranges before creating peers** — Overlapping CIDRs between your VPC and Acquia's network will cause routing conflicts.
2. **Test connectivity after setup** — SSH into an Acquia environment and ping a private address in your VPC to confirm the peering works.
3. **Document each VPN/peer with descriptive names** — Makes auditing easier when multiple connections exist.

---

## Related Topics

- **[Subscriptions](../subscriptions/SKILL.md)** — Shield ACL for IP-level access control
- **[Identity Providers](../identity-providers/SKILL.md)** — SSO authentication
- **[SSH Key Management](../ssh-key-management/SKILL.md)** — Secure access to environments
