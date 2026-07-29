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

  // Liveness only: is the process up? Cheap, unauthenticated, no internal detail.
  app.get("/health", (ctx) =>
    ctx.json({ ok: true, version: process.env.npm_package_version ?? "unknown" }),
  );

  // Readiness: can this instance actually serve traffic correctly?
  app.get("/ready", async (ctx) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {};

    try {
      await container.client.execute("SELECT 1");
      checks.database = { ok: true };
    } catch (err) {
      checks.database = { ok: false, error: stringifyErr(err) };
    }

    const status = container.watcherLoop.getStatus();
    const maxAge = 3 * env.pollMs;
    const tickAge = status.lastTickAt === null ? Infinity : Date.now() - status.lastTickAt;
    checks.watcher = {
      ok: tickAge <= maxAge,
      error: status.lastError ?? (tickAge > maxAge ? `stale tick (${tickAge}ms old)` : undefined),
    };

    // TODO(#issue-tbd): stubbed as always-ok until migration-state check is wired up
checks.migrations = { ok: true };
    // TODO(#issue-tbd): stubbed as always-ok until circuit breaker module exists — does not reflect real anchor health
checks.anchor = { ok: true, error: "not_implemented: no circuit breaker module yet" };
// TODO(#issue-tbd): stubbed as always-ok until trustline validator module exists — does not reflect real trustline state
checks.trustline = { ok: true, error: "not_implemented: no trustline validator module yet" };

    const allOk = Object.values(checks).every((c) => c.ok);
    return ctx.json({ ok: allOk, checks }, allOk ? 200 : 503);
  });

  app.route("/links", linkRoutes(container));
  app.route("/webhooks", webhookRoutes(container));

  container.start();

  serve({ fetch: app.fetch, port: env.apiPort }, (info) => {
    console.log(`[api] listening on http://localhost:${info.port}`);
    console.log(`[api] network=${container.config.network}  horizon=${container.config.horizonUrl}`);
    console.log(`[watcher] polling every ${env.pollMs}ms`);
  });

  const shutdown = () => {
    console.log("\n[api] shutting down…");
    container.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function stringifyErr(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});