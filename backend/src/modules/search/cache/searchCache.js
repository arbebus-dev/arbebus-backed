const { getRedisClient } = require("../../../db/redis/client");

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
      console.warn("[searchCache] Redis initialization failed:", err.message);
      redisClient = false;
    }
  }
  return redisClient;
}

async function getCache(key) {
  try {
    // Try Redis first if available
    const redis = await initRedis();
    if (redis) {
      const value = await redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
    }
  } catch (err) {
    console.warn("[searchCache] Redis get error:", err.message);
  }

  // Fallback to local cache
  const item = localCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    localCache.delete(key);
    return null;
  }
  return item.value;
}

async function setCache(key, value, ttlMs) {
  const ttl = Number(ttlMs || process.env.SEARCH_CACHE_TTL_SECONDS || 86400);
  const ttlMs_ = ttl * 1000;

  try {
    // Try Redis first if available
    const redis = await initRedis();
    if (redis) {
      await redis.setEx(key, ttl, JSON.stringify(value));
      return;
    }
  } catch (err) {
    console.warn("[searchCache] Redis set error:", err.message);
  }

  // Fallback to local cache
  localCache.set(key, { value, expiresAt: Date.now() + ttlMs_ });
}

async function clearCache() {
  try {
    const redis = await initRedis();
    if (redis) {
      await redis.flushDb();
    }
  } catch (err) {
    console.warn("[searchCache] Redis flush error:", err.message);
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
