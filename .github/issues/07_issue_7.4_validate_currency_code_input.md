---
title: "Validate ISO Currency Code Input in Cash-Out Endpoint"
labels: ["area:api", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "7.4"
---

## Summary
Add strict validation for `targetCurrency` string parameter in `POST /links/:id/cash-out` route (must be 3 uppercase alphabetical chars, e.g. `"NGN"`, `"CAD"`, `"USD"`).

## Context & File Hints
- File: `apps/api/src/routes/links.ts`
- Use Zod schema validation: `z.string().length(3).regex(/^[A-Z]{3}$/)`.

## Acceptance Criteria
- [ ] Invalid currency strings (e.g. `"ngn"`, `"123"`, `"NGA"`) return HTTP 400 with validation error.
- [ ] `pnpm typecheck` and `pnpm test` pass.
