---
title: "Add SEP-7 Payment Request URI Edge Case Tests"
labels: ["area:core", "type:docs", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "5.5"
---

## Summary
Expand unit test coverage in `@checkout/core` for SEP-7 payment URI builder edge cases, including unusual asset codes, special characters in memos, and extreme memo lengths.

## Context & File Hints
- File: `packages/core/test/sep7.test.ts`
- Add tests verifying URL escaping (%20), 28-byte text memo limits, and asset issuer formatting.

## Acceptance Criteria
- [ ] Added 4+ new test cases covering URI encoding edge cases.
- [ ] `pnpm --filter @checkout/core test` passes cleanly.
