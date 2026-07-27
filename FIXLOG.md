# Fix Log & Changelog

This log tracks resolved issues, architectural improvements, and bug fixes across the monorepo.

---

## Recent Fixes & Milestones

### 1. Webhook Retry with Exponential Backoff & HMAC Signatures
- **Component**: `apps/api` (`services/webhook-service.ts`)
- **Fix**: Added signature generation (`x-checkout-signature: sha256=<hex>`) and retry logic with exponential backoff for transient failures (`5xx`, network drops). Permanent client errors (`4xx`) fail fast without retrying.

### 2. Off-Ramp Native Asset Validation & Error Cleaning
- **Component**: `packages/offramp` (`testanchor.ts`)
- **Fix**: Added explicit asset validation for non-USDC off-ramp attempts with clear user-facing guidance. Fixed SEP-38 asset identification for Stellar testnet native assets.

### 3. API Deployment & CORS Configuration
- **Component**: `apps/api` (`render.yaml`, `env.ts`)
- **Fix**: Configured Render Web Service environment variables, CORS origin restriction, health checks, and Docker container setup.

### 4. Per-IP Rate Limiting Middleware
- **Component**: `apps/api` (`middleware/rate-limit.ts`)
- **Fix**: Protected public link creation and status endpoints against abuse using sliding window IP rate limiting.

### 5. Anchor Adapter (`TestAnchorOffRamp`)
- **Component**: `packages/offramp`
- **Fix**: Shipped real SEP-10 challenge authentication, SEP-38 quote fetching, and SEP-6 withdrawal initiation against `testanchor.stellar.org`.

### 6. Embeddable Widget Component (`widget.js`)
- **Component**: `apps/web` (`public/widget.js`)
- **Fix**: Added embeddable lightweight widget script rendering modal checkout interface for third-party websites.
