---
title: "Add Request Logging & Trace ID Middleware in Hono API"
labels: ["area:api", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "1.6"
---

## Summary
Add lightweight request logging middleware to `apps/api` using Hono's built-in logger or a custom middleware. Every incoming request should log the method, path, status code, response time in ms, and generate a unique `x-request-id` header if not present.

## Context & File Hints
- File: `apps/api/src/index.ts` and `apps/api/src/middleware/request-logger.ts`
- Use Hono's middleware syntax: `app.use('*', requestLogger())`

## Acceptance Criteria
- [ ] Each request logs `[METHOD] /path -> STATUS (duration_ms)`
- [ ] Response headers include `x-request-id`
- [ ] `pnpm typecheck` and `pnpm test` pass
