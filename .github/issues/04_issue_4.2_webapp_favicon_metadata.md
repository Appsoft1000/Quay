---
title: "Add Web App Favicon & OpenGraph Social Metadata"
labels: ["area:web", "type:docs", "complexity:small", "good-first-issue", "Stellar Wave: W7"]
issue_number: "4.2"
---

## Summary
Add SVG favicon asset and standard OpenGraph / Twitter meta tags in Next.js `apps/web` root layout.

## Context & File Hints
- Files: `apps/web/app/layout.tsx`, `apps/web/app/favicon.ico` / `favicon.svg`
- Define `metadata` export in Next.js layout with title, description, and social tags.

## Acceptance Criteria
- [ ] Next.js app renders valid favicon and OpenGraph metadata tags.
- [ ] `pnpm build` completes without warnings.
