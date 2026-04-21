require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../db/pool');

async function main() {
  const sql = fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf8');
  const pool = getPool();
  await pool.query(sql);
  await pool.query('REFRESH MATERIALIZED VIEW transit.service_days');
  await pool.query('REFRESH MATERIALIZED VIEW transit.route_stop_pairs');
  console.log('Transit schema applied successfully');
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
