---
title: "Add Structured Log Output for Webhook Delivery Retries"
labels: ["area:api", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "6.1"
---

## Summary
Add structured console logging (`[WEBHOOK_RETRY]`, attempt number, status, backoff delay) in `apps/api/src/services/webhook-service.ts` to improve observability during failed delivery retries.

## Context & File Hints
- File: `apps/api/src/services/webhook-service.ts`
- Include `endpointId`, `attempt`, `nextDelayMs`, and `error` in log line.

## Acceptance Criteria
- [ ] Retry loop emits clean, structured log lines on transient delivery failures.
- [ ] `pnpm typecheck` passes.
