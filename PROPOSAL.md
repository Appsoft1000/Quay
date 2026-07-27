# Proposal: The Inbound Counterpart to SDP

## Executive Summary

Stellar Disbursement Platform (SDP) revolutionized **outbound** payments on Stellar — enabling organizations to bulk-disburse digital assets to recipients globally. 

**Stellar Checkout** provides the complementary **inbound** layer: an open-source, non-custodial merchant checkout platform for the Stellar anchor network. It enables merchants to accept stablecoins (USDC) directly into non-custodial wallets and cash out to local currency via licensed Stellar anchors.

---

## Core Value Proposition

1. **Non-Custodial Merchant Settlement**:
   - Buyers pay stablecoins directly to the merchant's Stellar wallet.
   - Zero intermediate funds custody by the gateway.

2. **Anchor Network Off-Ramping**:
   - Integrates standard Stellar Ecosystem Proposals (SEP-6, SEP-10, SEP-38, SEP-24).
   - Enables direct settlement into local fiat bank accounts via licensed anchors.

3. **Developer-First Integration**:
   - Simple REST API for link creation and webhook notifications.
   - Embeddable ~5KB JavaScript widget (`widget.js`) for modal checkouts.

---

## Technical Strategy

- **Off-Ramp Mode**: Keep off-ramping `seller_initiated` (merchant receives USDC, then cashes out) to maintain non-custodial compliance status.
- **Corridor Liquidity Telemetry**: Record settlement rates and latency to demonstrate commercial volume and negotiate direct anchor relationships.
- **SEP Standardization**: Built exclusively on standard Stellar ecosystem protocols (SEP-6, SEP-7, SEP-10, SEP-38, SEP-24).
