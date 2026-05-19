const { getRedisClient } = require("../../../db/redis/client");
const { logger } = require("../../../core/logging/logger");

const localCache = new Map();
let redisClient = null;

// Initialize Redis client on first use
async function initRedis() {
  if (redisClient === null && !process.env.REDIS_URL) {
    redisClient = false; // Flag that Redis is unavailable
    return;
  }
  if (redisClient === null) {
    try {
      redisClient = await getRedisClient();
    } catch (err) {
      logger.warn("[searchCache] Redis initialization failed:", err.message);
      redisClient = false;
    }
  }
  return redisClient;
}

async function getCache(key) {
  // Local memory first. It is the fastest path and avoids a Redis/network hop
  // for repeated autocomplete/address searches on the same Render instance.
  const item = localCache.get(key);
  if (item) {
    if (Date.now() > item.expiresAt) {
      localCache.delete(key);
    } else {
      return item.value;
    }
  }

  try {
    const redis = await initRedis();
    if (redis) {
      const value = await redis.get(key);
      if (value) {
        const parsed = JSON.parse(value);
        const ttlSeconds = Number(process.env.SEARCH_CACHE_TTL_SECONDS || 86400);
        localCache.set(key, { value: parsed, expiresAt: Date.now() + ttlSeconds * 1000 });
        return parsed;
      }
    }
  } catch (err) {
    logger.warn("[searchCache] Redis get error:", err.message);
  }

  return null;
}

async function setCache(key, value, ttlMs) {
  const ttl = Number(ttlMs || process.env.SEARCH_CACHE_TTL_SECONDS || 86400);
  const ttlMs_ = ttl * 1000;

  // Always populate local memory. Redis is an optional shared layer.
  localCache.set(key, { value, expiresAt: Date.now() + ttlMs_ });

  // Prevent unbounded growth on long-lived instances.
  while (localCache.size > Number(process.env.SEARCH_LOCAL_CACHE_MAX || 2000)) {
    const first = localCache.keys().next().value;
    if (!first) break;
    localCache.delete(first);
  }

  try {
    const redis = await initRedis();
    if (redis) {
      await redis.setEx(key, ttl, JSON.stringify(value));
    }
  } catch (err) {
    logger.warn("[searchCache] Redis set error:", err.message);
  }
}

async function clearCache() {
  try {
    const redis = await initRedis();
    if (redis) {
      await redis.flushDb();
    }
  } catch (err) {
    logger.warn("[searchCache] Redis flush error:", err.message);
  }
  localCache.clear();
}

function cacheStats() {
  return {
    localSize: localCache.size,
    redis: redisClient ? "connected" : "disabled",
  };
}

module.exports = { getCache, setCache, clearCache, cacheStats };
