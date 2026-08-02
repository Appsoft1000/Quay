import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { createContainer } from "./services/container";
import { linkRoutes } from "./routes/links";
import { webhookRoutes } from "./routes/webhooks";
import { publicRoutes } from "./routes/public";
import { metricsRoutes } from "./routes/metrics";
import { authRoutes } from "./routes/auth";
import { wellKnownRoutes } from "./routes/well-known";
import { kycRoutes } from "./routes/kyc";
import { rateLimit, MemoryStore } from "./middleware/rate-limit";
import { RedisStore } from "./middleware/redis-store";

const SHUTDOWN_TIMEOUT_MS = env.shutdownTimeoutMs;

async function main(): Promise<void> {
  const container = await createContainer();

  const app = new Hono();
  const rateLimitStore = env.redisUrl ? new RedisStore(env.redisUrl) : new MemoryStore();
  app.use(
    "*",
    cors({
      origin: env.corsOrigins,
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
      // The session cookie is sent cross-origin (API and web app are separate
      // hosts) — credentials: true plus an explicit (non-"*") origin list is
      // required for the browser to actually attach/accept it.
      credentials: true,
    }),
  );
  app.use(
    "*",
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMax,
      store: rateLimitStore,
      trustProxyHops: env.trustProxyHops,
    }),
  );
  const strictRateLimit = rateLimit({
    windowMs: env.rateLimitStrictWindowMs,
    max: env.rateLimitStrictMax,
    store: rateLimitStore,
    trustProxyHops: env.trustProxyHops,
  });

  // Liveness: the process is up and answering HTTP at all.
  app.get("/health", async (ctx) => {
    const usdcTrustline = await container.service
      .checkSellerUsdcTrustline()
      .catch(() => ({ ok: false as const, reason: "check_failed", message: "trustline preflight check failed" }));
    return ctx.json({
      ok: true,
      network: container.config.network,
      sellerWallet: container.config.sellerWallet,
      usdcTrustline,
      horizon: container.horizonStatus(),
      // Anchor health probe + circuit breaker (issue #19, 3.7) so an operator
      // can tell "the anchor is down" apart from "the API is down" without
      // tailing logs.
      anchor: container.service.healthSnapshot(),
    });
  });

  // Readiness: can this instance actually serve traffic right now? Distinct
  // from liveness — a container HEALTHCHECK / orchestrator readiness probe
  // should use this, not /health, to decide whether to route traffic here.
  // `ok` gates on the database ONLY. Watcher circuit-breaker state is reported
  // for diagnostics but deliberately does NOT fail readiness: this endpoint is
  // now Render's healthCheckPath and the Dockerfile HEALTHCHECK, and a Horizon
  // blip opening a breaker must not depool an instance that can still serve
  // checkout pages and link creation.
  app.get("/ready", async (ctx) => {
    const ok = await container.ready();
    const circuitBreakers = container.getWatcherCircuitBreakerStatus();
    const metrics = container.getWatcherMetrics();

    return ctx.json({
      ok,
      circuitBreakers,
      metrics: {
        accountsWatched: metrics.accountsWatched,
        tickDurationMs: metrics.tickDurationMs,
        circuitBreakersOpen: metrics.circuitBreakersOpen,
        perAccountLag: Object.fromEntries(metrics.perAccountLag),
      },
    }, ok ? 200 : 503);
  });

  app.route("/links", linkRoutes(container, strictRateLimit));
  app.route("/webhooks", webhookRoutes(container));
  app.route("/r", publicRoutes(container));

  // CORS for public receipt endpoint (accessible from any origin).
  app.use("/r/*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));
  app.route("/metrics", metricsRoutes(container));
  app.route(
    "/auth",
    authRoutes({
      challenge: container.auth.challenge,
      session: container.auth.session,
      sellers: container.sellers,
      revocations: container.auth.revocations,
      secureCookie: container.auth.secureCookie,
    }),
  );
  app.route("/.well-known", wellKnownRoutes(container.auth.stellarToml));
  app.route("/seller/kyc", kycRoutes(container));

  container.start();

  let server: ReturnType<typeof serve> | undefined = serve({ fetch: app.fetch, port: env.apiPort }, (info) => {
    console.log(`[api] listening on http://localhost:${info.port}`);
    console.log(`[api] network=${container.config.network}  horizon=${container.config.horizonUrl}`);
    console.log(`[api] seller wallet (receives funds): ${container.config.sellerWallet}`);
    console.log(`[watcher] polling every ${env.pollMs}ms`);
  });

  // Graceful shutdown: stop accepting new connections, let in-flight HTTP
  // requests finish, then stop the watcher/poller. A hard deadline guards
  // against a connection that never closes (e.g. a stuck keep-alive) so the
  // process still exits before the orchestrator's own SIGKILL timeout.
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[api] shutting down…");

    const forceExit = setTimeout(() => {
      console.warn("[api] shutdown grace period elapsed - forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      container.stop();
      clearTimeout(forceExit);
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});
