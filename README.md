# Stellar Checkout

Non-custodial stablecoin **checkout + payment links** on Stellar, with a deliberately
**swappable off-ramp seam** so the seller can later cash out to local currency without a rewrite.

**Live demo (Stellar testnet):** [dashboard](https://quay-web.vercel.app) ·
[API](https://quay-api.onrender.com/health) — create a link, pay it from any
testnet wallet with the shown memo, and watch it flip to **paid**. Cash-out runs
a real SEP-10 → SEP-38 → SEP-6 flow against `testanchor.stellar.org` (USD quotes;
testnet only, no real money moves).

The loop, end to end:

1. A seller creates a payment link in the dashboard (title + amount + asset).
2. The buyer opens the checkout page, scans a QR (or taps a wallet deep-link), and pays
   **USDC straight to the seller's own Stellar wallet** — nothing is custodied in between.
3. A backend worker watches the ledger, matches the incoming payment to the link by memo,
   marks it **paid**, and fires any registered webhooks.
4. When the seller wants cash, they trigger a **seller-initiated** cash-out to local currency
   through the off-ramp adapter.

This is the non-custodial version of a hosted checkout (think Stripe-style PaymentIntent),
built on the chain whose anchor network can actually settle to local rails.

---

## Why it's shaped this way

The link + checkout + on-chain payment is the easy, commodity part. The **off-ramp is the
hard 80% and the whole moat** — and it isn't a step you bolt on, it's a corridor walking back
in: FX rate risk in flight, KYC on the payout, reconciliation that proves local currency
landed, recovery when the anchor is down.

So two deliberate boundaries are baked into the architecture:

- **Off-ramp runs `seller_initiated`, not `inline`.** The seller receives the stablecoin to a
  wallet they control and cashes out as a separate, authorized action. Custody stays at the
  edges. `inline` mode (value routed through the anchor mid-flight, seller receives local
  currency directly) is what merchants ultimately want — and it is the mode that puts you in
  the money-transmission / custody box. The `OffRampPort` already models both modes; do not
  flip to `inline` until a licensed anchor relationship and a compliance story are real.

- **Ports-and-adapters everywhere.** The domain never imports a chain SDK. `RailPort`,
  `WatcherPort`, and `OffRampPort` are the seams. Today: a Stellar (SEP-7 + Horizon) rail and a
  mock anchor. Tomorrow: the same `PaymentIntent` spine behind an `adapter-gateway` (Arc/Circle)
  or a different chain — without touching the domain or the worker.

---

## Monorepo layout

```
packages/
  core/        Domain brain — entities, status machine, money math, SEP-7 builder,
               the pure payment matcher, port interfaces, zod schemas.  (29 unit tests)
  stellar/     Stellar adapter — SEP-7 rail + Horizon polling watcher (RailPort/WatcherPort).
  offramp/     Off-ramp adapter — MockAnchorOffRamp (OffRampPort, seller_initiated).  *** mock ***
apps/
  api/         Hono API + Drizzle (libSQL) + the ledger-watching worker.
  web/         Next.js (App Router) seller dashboard + buyer checkout page.
```

`core` is the only package with business logic worth unit-testing in isolation, and it is:
money is compared in integer **stroops** (never floats), the status machine rejects illegal
transitions, the SEP-7 builder is spec-checked, and the matcher is exhaustively tested for
paid / overpaid / underpaid / wrong-asset / no-memo / unknown-reference.

---

## Run it locally

Requirements: Node 20+ and pnpm 9.

```bash
pnpm install
cp .env.example .env
```

Two processes (two terminals):

```bash
# 1) API + ledger watcher  →  http://localhost:8787
pnpm --filter @checkout/api dev

# 2) Web dashboard + checkout  →  http://localhost:3000
pnpm --filter @checkout/web dev
```

On first boot with no `DEFAULT_SELLER_WALLET` set, the API generates a **throwaway testnet
keypair**, prints it, and gives you a Friendbot link to fund it. Set `DEFAULT_SELLER_WALLET`
in `.env` to a wallet you control to reuse a stable address across restarts.

Then: open the dashboard, create a link, open its checkout page, and pay the displayed amount
of USDC **with the shown memo** from any Stellar testnet wallet. Within a poll interval the
dashboard flips the link to **paid**; hit **Cash out to NGN** to exercise the off-ramp seam.

Useful scripts (from the repo root):

```bash
pnpm typecheck   # all packages
pnpm test        # core unit tests
pnpm build       # builds the web app
```

---

## Docker image (`apps/api`)

`apps/api/Dockerfile` is a 3-stage build (`deps` → `build` → `runtime`): the
runtime stage carries only apps/api's real npm production dependencies (all
workspace source is bundled into one compiled `dist/index.js` via esbuild -
see the `build` script in `apps/api/package.json`) and runs as the non-root
`node` user.

- **Base image** is pinned by digest (`node:22-alpine@sha256:...`, see the
  `ARG BASE_IMAGE` at the top of the Dockerfile) - bump it at least monthly,
  or immediately on a disclosed CVE, per that same comment.
- **Signals**: `tini` runs as PID 1 (`ENTRYPOINT`) so `SIGTERM` actually
  reaches the Node process, which drains in-flight HTTP requests before
  exiting (`apps/api/src/index.ts`).
- **Health**: `/health` is liveness (process is up); `/ready` is readiness
  (database is actually reachable) - the `HEALTHCHECK` and Render's
  `healthCheckPath` both use `/ready`.
- **Size target**: under 200 MB, enforced in CI (`.github/workflows/ci.yml`'s
  `docker` job fails the build if it isn't). Not independently measured
  outside CI in this change - no Docker daemon was available in the
  environment this change was authored in, so the size shown above is a
  target the CI job checks on every push, not a number hand-verified here.
- **Security scanning**: the same CI job runs a Trivy scan, failing on any
  HIGH/CRITICAL finding.
- **Read-only root filesystem**: the app writes nothing to disk in
  production (remote Turso database, no local files), so the image is
  compatible with `docker run --read-only --tmpfs /tmp` or an orchestrator's
  equivalent read-only-root setting - Render's blueprint format has no field
  for this today, so it isn't set in `render.yaml`, but nothing in the image
  requires a writable root filesystem.

---

## What's real vs. stubbed

| Piece | Status |
| --- | --- |
| SEP-7 payment-request URIs | **Real**, spec-correct (native vs issued asset, memo ≤28 bytes, %20 encoding, network passphrase). |
| Horizon payment watching + memo matching | **Real** logic against the Stellar SDK v16 API. Polling (restart-safe), idempotent via persisted cursor + processed-tx ledger. |
| Status lifecycle, webhooks (HMAC-SHA256 signed) | **Real**. |
| Persistence | **Real**, libSQL/SQLite for zero-config local dev (swap the `DATABASE_URL` for Turso/Postgres). Tables self-initialize on boot. |
| Off-ramp (`@checkout/offramp`) | **Real, opt-in.** Set `OFFRAMP=testanchor` for a genuine SEP-10 → SEP-38 → SEP-6 flow against the public Stellar testnet anchor (`https://testanchor.stellar.org`). Defaults to `OFFRAMP=mock` (`MockAnchorOffRamp`, fake FX rate, no money moves) for offline dev — the dashboard labels the cash-out button "(simulated)" whenever mock mode is active. |
| Auth | **Not implemented.** Single hard-coded demo seller, no API keys / login. Fine for a demo, not for production. |

---

## Before you go live (the parts code can't do)

1. **Verify the USDC issuer.** `.env.example` ships placeholder Circle issuers for testnet and
   public. Confirm the current issuer for your network before relying on it — a wrong issuer
   silently matches nothing (or the wrong asset).
2. **Get a real anchor relationship first.** A checkout that dead-ends in USDC isn't the
   product. `packages/offramp/src/testanchor.ts` is a real SEP-10 → SEP-38 → SEP-6 adapter, but
   against Stellar's public *testnet reference sandbox* — not a licensed anchor. Fork its shape
   for a production adapter against a licensed Nigerian anchor's SEP endpoints, and validate the
   anchor will actually onboard you and pay out **before** building further.
3. **Don't enable `inline` off-ramp without legal review.** See the boundary note above.
4. **Add auth** (API keys per seller + a real login) before anyone but you touches it.
5. **Multiple sellers / scale:** the watcher polls per active destination account; for many
   sellers you may want a streaming `WatcherPort` implementation (the interface already allows it).

> This README is engineering guidance, not legal advice. Money transmission is the box you do
> not want to back into by accident.

---

## Docs & contributing

- **[HTTP API reference](docs/API.md)** — endpoints, request/response shapes, and webhook delivery.
- **[Contributing](CONTRIBUTING.md)** — setup, the check suite, and PR guidelines.
- **[Security policy](SECURITY.md)** — how to report a vulnerability privately.
- **[Code of conduct](CODE_OF_CONDUCT.md)**.

Licensed under the [Apache License 2.0](LICENSE).
