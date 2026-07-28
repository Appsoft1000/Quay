import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { createContainer } from "./services/container";
import { linkRoutes } from "./routes/links";
import { webhookRoutes } from "./routes/webhooks";
import { rateLimit } from "./middleware/rate-limit";

async function main(): Promise<void> {
  const container = await createContainer();

  const app = new Hono();
  app.use("*", cors({ origin: env.corsOrigins, allowMethods: ["GET", "POST", "OPTIONS"] }));
  app.use("*", rateLimit({ windowMs: env.rateLimitWindowMs, max: env.rateLimitMax }));

  // Liveness: the process is up and answering HTTP at all.
  app.get("/health", (ctx) =>
    ctx.json({
      ok: true,
      network: container.config.network,
      sellerWallet: container.config.sellerWallet,
    }),
  );

  // Readiness: can this instance actually serve traffic right now (database
  // reachable)? Distinct from liveness - a container HEALTHCHECK/orchestrator
  // readiness probe should use this one, not /health, to decide whether to
  // route traffic here.
  app.get("/ready", async (ctx) => {
    const ok = await container.ready();
    return ctx.json({ ok }, ok ? 200 : 503);
  });

  app.route("/links", linkRoutes(container));
  app.route("/webhooks", webhookRoutes(container));

  container.start();

  const server = serve({ fetch: app.fetch, port: env.apiPort }, (info) => {
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
