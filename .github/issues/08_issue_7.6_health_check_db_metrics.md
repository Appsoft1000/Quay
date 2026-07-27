---
title: "Add Health Check Endpoint Database & Anchor Status Echo"
labels: ["area:api", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "7.6"
---

## Summary
Enhance `GET /health` in `apps/api` to verify database connectivity (`db.select().from(links).limit(1)`) and echo current off-ramp mode (`OFFRAMP=mock` vs `OFFRAMP=testanchor`).

## Context & File Hints
- File: `apps/api/src/routes/health.ts` (or `apps/api/src/index.ts`)
- Response shape: `{ ok: true, network: "testnet", dbConnected: true, offrampMode: "testanchor", sellerWallet: "G..." }`.

## Acceptance Criteria
- [ ] `GET /health` returns DB connectivity status and off-ramp mode.
- [ ] Return HTTP 503 if database check fails.
