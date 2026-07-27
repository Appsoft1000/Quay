---
title: "Add Copy-to-Clipboard Button and Toast Notification on Payment QR"
labels: ["area:web", "type:enhancement", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "8.7"
---

## Summary
Add a quick "Copy URI" button next to the payment QR code on the buyer checkout page (`apps/web/app/components/CheckoutClient.tsx`) with visual feedback toast upon copying.

## Context & File Hints
- File: `apps/web/app/components/CheckoutClient.tsx`
- Use `navigator.clipboard.writeText(request.uri)` with temporary "Copied!" button state.

## Acceptance Criteria
- [ ] Clicking "Copy URI" copies `web+stellar:pay?...` to clipboard.
- [ ] Button displays feedback state ("Copied!") for 2 seconds.
