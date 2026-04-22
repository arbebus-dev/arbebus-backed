const Redis = require("ioredis");

let client = null;

function getRedis() {
  if (client) return client;

  if (!process.env.REDIS_URL) {
    console.warn("⚠️ REDIS_URL not set, running without Redis");
    return null;
  }

  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
  });

  client.on("connect", () => console.log("🟢 Redis connected"));
  client.on("error", (err) => console.error("🔴 Redis error", err));

  return client;
}

module.exports = { getRedis };