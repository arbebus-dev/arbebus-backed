const { Pool } = require('pg');
const { env } = require('../core/config/env');

const pool = env.DATABASE_URL ? new Pool({ connectionString: env.DATABASE_URL }) : null;

function getPool() {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool;
}

module.exports = { getPool };
