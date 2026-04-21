require('dotenv').config();
const { Pool } = require('pg');
const { env } = require('../config/env');

let pool = null;

function getPool() {
  if (pool) return pool;

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. PostgreSQL is required for transit planner.');
  }

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes('localhost')
      ? false
      : {
          rejectUnauthorized: false,
        },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  pool.on('error', (error) => {
    console.error('PostgreSQL pool error:', error);
  });

  return pool;
}

async function query(text, params) {
  const activePool = getPool();
  return activePool.query(text, params);
}

module.exports = {
  getPool,
  query,
};
