---
title: "Expose Standard Rate Limit Headers in Hono API"
labels: ["area:api", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "3.4"
---

## Summary
Ensure the rate limiting middleware in `apps/api` sets standard HTTP headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) on all rate-limited routes.

## Context & File Hints
- File: `apps/api/src/middleware/rate-limit.ts`
- Populate standard headers for every client request based on current window stats.

## Acceptance Criteria
- [ ] Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
- [ ] `pnpm typecheck` and `pnpm test` pass cleanly.
