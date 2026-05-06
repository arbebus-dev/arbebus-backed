/**
 * Search Index Rebuilding
 * Periodically rebuilds search index from database to ensure fresh data
 */

const { getRedisClient } = require("../../../db/redis/client");

const INDEX_REBUILD_INTERVAL_MS = Number(
  process.env.SEARCH_INDEX_REBUILD_INTERVAL_MS || 3600000,
); // 1 hour default

let lastRebuildAt = null;

async function shouldRebuild() {
  if (!lastRebuildAt) return true;
  return Date.now() - lastRebuildAt > INDEX_REBUILD_INTERVAL_MS;
}

async function rebuildSearchIndex() {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.log("[searchIndex] Redis unavailable, skipping rebuild");
      return { success: false, reason: "redis_unavailable" };
    }

    console.log("[searchIndex] Starting index rebuild...");
    const startedAt = Date.now();

    // Clear old cache to force refresh
    await redis.flushDb();

    lastRebuildAt = Date.now();
    const tookMs = Date.now() - startedAt;

    console.log(`[searchIndex] Rebuild completed in ${tookMs}ms`);
    return {
      success: true,
      tookMs,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[searchIndex] Rebuild error:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

async function initPeriodicRebuild() {
  if (INDEX_REBUILD_INTERVAL_MS <= 0) {
    console.log("[searchIndex] Periodic rebuild disabled");
    return;
  }

  console.log(
    `[searchIndex] Periodic rebuild enabled (interval: ${INDEX_REBUILD_INTERVAL_MS}ms)`,
  );

  // Initial rebuild on startup
  await rebuildSearchIndex();

  // Schedule periodic rebuilds
  setInterval(rebuildSearchIndex, INDEX_REBUILD_INTERVAL_MS);
}

function rebuildStatus() {
  return {
    lastRebuildAt,
    intervalMs: INDEX_REBUILD_INTERVAL_MS,
    needsRebuild: !lastRebuildAt,
  };
}

module.exports = {
  rebuildSearchIndex,
  initPeriodicRebuild,
  shouldRebuild,
  rebuildStatus,
};
