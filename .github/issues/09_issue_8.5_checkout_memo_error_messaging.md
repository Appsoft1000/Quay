---
title: "Improve Memo Copying & Warning Notice in Checkout UI"
labels: ["area:web", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "8.5"
---

## Summary
Add explicit warning badge in `apps/web/app/components/CheckoutClient.tsx` reminding buyers that Stellar payments **must** include the exact transaction memo to settle automatically.

## Context & File Hints
- File: `apps/web/app/components/CheckoutClient.tsx`
- Add warning alert component near the memo text box: *"Important: Payments sent without this memo cannot be matched to your order."*

## Acceptance Criteria
- [ ] Warning notice displays prominently on buyer checkout page.
- [ ] `pnpm build` completes without errors.
