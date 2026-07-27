# Issues & Roadmap Backlog

This document tracks active development tasks, open feature requests, and planned enhancements for Stellar Checkout.

---

## Active & Post-Entry Roadmap

### 1. `OffRampPort` Union for SEP-24 Interactive Flow
- **Priority**: High
- **Description**: Extend `OffRampPort` initiation result to support interactive SEP-24 web flows:
  ```ts
  type OffRampInitiation =
    | { kind: "fields"; jobId: string }                      // SEP-6
    | { kind: "interactive"; jobId: string; url: string };   // SEP-24
  ```

### 2. Telemetry Table for Anchor Latency & NGN Spreads
- **Priority**: Medium
- **Description**: Add database recording for all off-ramp jobs: `(anchor, corridor, quoted_rate, quoted_at, settled_at, effective_rate, status)` to build an empirical dataset of anchor reliability and settlement speed.

### 3. Wallet-Native Auth & Multi-Tenancy
- **Priority**: High
- **Description**: Implement SEP-10 challenge signing via Stellar Wallets Kit. Replace hardcoded demo seller with scoped accounts, JWT sessions, and hashed API keys (`ak_live_...`).

### 4. Direct Anchor Relationship Onboarding (LINK SEP-24 Adapter)
- **Priority**: High
- **Description**: Build production adapter for LINK (`ngnc.online`) SEP endpoints leveraging live checkout volume and telemetry.

### 5. Multi-Seller Streaming Watcher (`WatcherPort`)
- **Priority**: Medium
- **Description**: Upgrade ledger watcher from polling to streaming for high-concurrency multi-account merchant watch loops.
