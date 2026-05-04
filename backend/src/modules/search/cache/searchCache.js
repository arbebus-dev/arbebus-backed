const cache = new Map();

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value, ttlMs) {
  const ttl = Number(ttlMs || process.env.SEARCH_CACHE_TTL_SECONDS || 86400) * 1000;
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

function clearCache() {
  cache.clear();
}

function cacheStats() {
  return { size: cache.size };
}

module.exports = { getCache, setCache, clearCache, cacheStats };
