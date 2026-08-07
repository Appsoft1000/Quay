import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { bootstrap } from "../src/db/client";
import * as schema from "../src/db/schema";
import { getTableConfig } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
//  bootstrap() must bring an OLD database up to the current schema.
//
//  A fresh database gets everything from BOOTSTRAP_SQL's CREATE TABLE, so tests
//  that start empty prove nothing about migrations. The failure this guards
//  against only appears against a database that already exists — which is to
//  say, only in production.
//
//  BUG-4.16: `MIGRATION_SQL` and `MIGRATIONS_SQL` both existed, one letter
//  apart, and bootstrap() only ever executed the plural one. The four columns
//  in the singular array were never added to any pre-existing database. It
//  stayed invisible until the API booted against the real Turso instance and
//  every SELECT on `links` failed at once.
// ---------------------------------------------------------------------------

/** The `links` table exactly as it shipped before any additive migration. */
const LEGACY_LINKS = `CREATE TABLE links (
  id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, seller_id TEXT NOT NULL,
  destination TEXT NOT NULL, title TEXT NOT NULL, amount TEXT NOT NULL,
  asset_code TEXT NOT NULL, asset_issuer TEXT, status TEXT NOT NULL,
  tx_hash TEXT, payer TEXT, paid_amount TEXT,
  offramp_job_id TEXT, offramp_target_currency TEXT, offramp_status TEXT,
  expires_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
)`;

const LEGACY_LINK_PAYMENTS = `CREATE TABLE link_payments (
  id TEXT PRIMARY KEY, link_id TEXT NOT NULL, tx_hash TEXT NOT NULL UNIQUE,
  payer TEXT NOT NULL, amount TEXT NOT NULL,
  asset_code TEXT NOT NULL, asset_issuer TEXT,
  created_at INTEGER NOT NULL
)`;

const LEGACY_SELLERS = `CREATE TABLE sellers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, wallet TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
)`;

async function columnsOf(client: ReturnType<typeof createClient>, table: string): Promise<string[]> {
  const res = await client.execute(`PRAGMA table_info(${table})`);
  return res.rows.map((r) => String(r.name));
}

describe("bootstrap() against a pre-existing database", () => {
  it("adds every column the current schema expects to a legacy links table", async () => {
    const client = createClient({ url: "file::memory:" });
    await client.execute(LEGACY_LINKS);
    await client.execute(LEGACY_LINK_PAYMENTS);
    await client.execute(LEGACY_SELLERS);

    await bootstrap(client);

    // Derived from the drizzle schema rather than hardcoded, so a column added
    // in future without a matching migration fails here instead of in prod.
    const expected = getTableConfig(schema.links).columns.map((c) => c.name);
    const actual = await columnsOf(client, "links");
    const missing = expected.filter((c) => !actual.includes(c));

    expect(missing).toEqual([]);
  });

  it("adds link_payments.ledger to a legacy table", async () => {
    const client = createClient({ url: "file::memory:" });
    await client.execute(LEGACY_LINKS);
    await client.execute(LEGACY_LINK_PAYMENTS);
    await client.execute(LEGACY_SELLERS);

    await bootstrap(client);

    const expected = getTableConfig(schema.linkPayments).columns.map((c) => c.name);
    const actual = await columnsOf(client, "link_payments");
    expect(expected.filter((c) => !actual.includes(c))).toEqual([]);
  });

  it("adds sellers.payout_fields_json to a legacy table", async () => {
    const client = createClient({ url: "file::memory:" });
    await client.execute(LEGACY_LINKS);
    await client.execute(LEGACY_LINK_PAYMENTS);
    await client.execute(LEGACY_SELLERS);

    await bootstrap(client);

    expect(await columnsOf(client, "sellers")).toContain("payout_fields_json");
  });

  it("is idempotent — a second run over a migrated database is a no-op", async () => {
    const client = createClient({ url: "file::memory:" });
    await client.execute(LEGACY_LINKS);
    await client.execute(LEGACY_LINK_PAYMENTS);
    await client.execute(LEGACY_SELLERS);

    await bootstrap(client);
    const after1 = await columnsOf(client, "links");
    await expect(bootstrap(client)).resolves.not.toThrow();
    expect(await columnsOf(client, "links")).toEqual(after1);
  });

  it("a fresh database ends up with the same columns as a migrated legacy one", async () => {
    // The two paths — CREATE TABLE for new databases, ALTER for old ones — drift
    // apart silently. Comparing them is what keeps a column added to one from
    // being forgotten in the other.
    const legacy = createClient({ url: "file::memory:" });
    await legacy.execute(LEGACY_LINKS);
    await legacy.execute(LEGACY_LINK_PAYMENTS);
    await legacy.execute(LEGACY_SELLERS);
    await bootstrap(legacy);

    const fresh = createClient({ url: "file::memory:" });
    await bootstrap(fresh);

    for (const table of ["links", "link_payments", "sellers"]) {
      const a = (await columnsOf(legacy, table)).slice().sort();
      const b = (await columnsOf(fresh, table)).slice().sort();
      expect(a, `${table} drifted between the fresh and migrated paths`).toEqual(b);
    }
  });
});
