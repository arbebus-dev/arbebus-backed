let redisClient = null;
const { logger } = require("../../core/logging/logger");

async function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  try {
    if (redisClient) {
      return redisClient;
    }

    const { createClient } = require("redis");

    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: false,
      },
    });

    redisClient.on("error", (error) => {
      logger.warn("[redis] unavailable:", error?.message || error);
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.warn("[redis] disabled:", error?.message || error);
    redisClient = null;
    return null;
  }
}

module.exports = {
  getRedisClient,
};
