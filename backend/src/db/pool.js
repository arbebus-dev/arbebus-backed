const { Pool } = require("pg");

/**
 * Arbebus PostgreSQL pool
 *
 * Goals:
 * - one global Pool for the whole backend process;
 * - no new Pool per request/provider;
 * - stable Render/Postgres SSL;
 * - fast fail when DB is unavailable;
 * - safe recovery if the pool emits an error.
 */

let pool = null;

function mustGetDatabaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url || typeof url !== "string" || !url.trim()) {
    throw new Error("DATABASE_URL is not set");
  }

  return url.trim();
}

function shouldUseSsl(connectionString) {
  if (process.env.PGSSLMODE === "disable") return false;
  if (process.env.PGSSL === "false") return false;

  // Render/Postgres cloud URLs require SSL. Local DB usually does not.
  if (connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
    return process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false;
  }

  return { rejectUnauthorized: false };
}

function createPool() {
  const connectionString = mustGetDatabaseUrl();

  const nextPool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString),

    // Keep one small, stable pool. Search requests are short.
    max: Number(process.env.PG_POOL_MAX || 5),
    min: 0,

    // Important for cloud DB connections.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,

    // Fail fast if DB connection is unavailable.
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5_000),

    // Close idle clients so stale Render connections are not reused forever.
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),

    // Prevent accidental long-running queries, but do not kill normal index searches.
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 30_000),
    query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 30_000),
    idle_in_transaction_session_timeout: Number(
      process.env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS || 30_000
    ),

    application_name: process.env.PGAPPNAME || "arbebus-backend",
  });

  nextPool.on("connect", (client) => {
    // These are session-level settings. They make search predictable and avoid
    // full-table sequential scans when indexes are available.
    client
      .query(`
        SET statement_timeout = '${Number(process.env.PG_STATEMENT_TIMEOUT_MS || 30000)}ms';
        SET idle_in_transaction_session_timeout = '${Number(
          process.env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS || 30000
        )}ms';
        SET enable_seqscan = off;
      `)
      .catch((err) => {
        console.warn("[postgres] session setup warning:", err.message);
      });
  });

  nextPool.on("error", (err) => {
    console.error("[postgres] idle client error:", err.message);

    // Do not keep a poisoned pool reference.
    if (pool === nextPool) {
      pool = null;
    }
  });

  return nextPool;
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

async function closePool() {
  if (!pool) return;

  const current = pool;
  pool = null;

  await current.end();
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = {
  getPool,
  closePool,
  query,
};
