---
title: "Add Friendly Zod Schema Validation Error Formatter"
labels: ["area:core", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "2.3"
---

## Summary
Improve Zod validation error formatting in `packages/core` schemas helper so API validation errors return clean field-level error messages instead of raw Zod Issue arrays.

## Context & File Hints
- File: `packages/core/src/schemas.ts`
- Implement `formatZodError(error: ZodError)` returning `{ field: string, message: string }[]`.

## Acceptance Criteria
- [ ] Zod schema errors yield clean `{ field, message }` output.
- [ ] Add unit tests in `packages/core/test/schemas.test.ts`.
