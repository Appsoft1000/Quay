# Architecture Overview

Stellar Checkout is the open-source, non-custodial merchant checkout for the Stellar anchor network — the inbound counterpart to the Stellar Disbursement Platform.

This document details the architectural boundaries, domain port design, and component layout of the system.

---

## High-Level Topology

```
                  ┌──────────────────────────────────────────────┐
                  │                 Buyer Wallet                 │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         │  USDC Transfer + Memo
                                         ▼
┌──────────────────────┐       ┌───────────────────┐        ┌──────────────────────┐
│  Embeddable Widget   ├──────►│    Stellar Web    ├───────►│     Horizon SDK      │
│  (quay-web/widget.js)│       │ (Next.js Dashboard│        │   (Stellar Ledger)   │
└──────────────────────┘       │  & Checkout Page) │        └──────────┬───────────┘
                               └─────────┬─────────┘                   │
                                         │                             │
                                         ▼                             │ Horizon Polling
                               ┌───────────────────┐                   │
                               │   Stellar API     │◄──────────────────┘
                               │(Hono + Drizzle DB)│
                               └─────────┬─────────┘
                                         │
                                         ├──────────────────────────┐
                                         ▼                          ▼
                               ┌───────────────────┐      ┌───────────────────┐
                               │  Off-Ramp Adapter │      │ Webhook Delivery  │
                               │(SEP-10/-38/-6)    │      │  (HMAC Signed)    │
                               └─────────┬─────────┘      └───────────────────┘
                                         │
                                         ▼
                               ┌───────────────────┐
                               │  Anchor Network   │
                               │(Local Bank Rails) │
                               └───────────────────┘
```

---

## Clean Architecture & Ports

The codebase follows strict **Ports & Adapters (Hexagonal Architecture)**. The domain logic in `@checkout/core` has zero external dependencies on chain SDKs, web frameworks, or databases.

### Key Ports (`@checkout/core/src/ports`)

1. **`RailPort`**
   - Encapsulates payment request URI construction (SEP-7 formatted URIs).
   - Keeps chain-specific formatting logic outside business entities.

2. **`WatcherPort`**
   - Defines the ledger ingestion contract: given a destination wallet and cursor, yields matching payment events on-chain.

3. **`OffRampPort`**
   - Decouples local currency off-ramping.
   - Operating mode: `seller_initiated`. The seller retains total custody of their stablecoins and triggers settlement as a explicit action.
   - Implementations: `MockAnchorOffRamp` (development/simulation) and `TestAnchorOffRamp` (real SEP-10 auth → SEP-38 quote → SEP-6 withdrawal against `testanchor.stellar.org`).

---

## Monorepo Layout & Responsibilities

```
packages/
  core/        Domain brain — entities, status machine, integer stroop math,
               SEP-7 builder, pure payment matcher, port interfaces, Zod schemas.
  stellar/     Stellar adapter — SEP-7 payment request builder + Horizon polling watcher.
  offramp/     Off-ramp adapter — MockAnchorOffRamp & TestAnchorOffRamp (SEP-10/38/6).
apps/
  api/         Hono API + Drizzle (libSQL) + background ledger-watching worker + webhook delivery.
  web/         Next.js (App Router) seller dashboard, buyer checkout page, and embeddable widget.
```

---

## Data Flow & Lifecycle

```
[Pending]  ───(Payment matched)───►  [Paid]  ───(Cash out triggered)───►  [Offramp Pending]
    │                                  │                                           │
    ├───(Expiry / Underpaid)           └───(Overpaid detected)                     ├───► [Offramp Settled]
    ▼                                  ▼                                           ▼
[Expired / Underpaid]             [Paid (Overpaid flag)]                      [Offramp Failed]
```

1. **Link Creation**: Seller creates a payment link via dashboard or API (`POST /links`). A unique memo string is generated.
2. **On-Chain Settlement**: Buyer opens checkout, scans QR / deep-links, and pays exact USDC to seller destination with the memo.
3. **Watcher Matching**: The API background worker polls Horizon, matches `memo` + `destination` + `amount`, updates database state to `paid`, and dispatches `link.paid` webhooks with HMAC-SHA256 signatures.
4. **Off-Ramp Redemption**: Seller triggers cash-out (`POST /links/:id/cash-out`). The off-ramp port runs SEP-10 auth, gets SEP-38 FX quote, and executes SEP-6 withdrawal to payout rails.
