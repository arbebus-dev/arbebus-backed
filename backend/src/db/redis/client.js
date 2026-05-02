const { createClient } = require('redis');
const { env } = require('../../core/config/env');

let client;

async function getRedisClient() {
  if (!env.REDIS_URL) return null;
  if (!client) {
    client = createClient({ url: env.REDIS_URL });
    client.on('error', (error) => console.error('[redis]', error.message));
    await client.connect();
  }
  return client;
}

module.exports = { getRedisClient };
