require("dotenv").config();

const { getPool } = require("../db/pool");

async function main() {
  const pool = getPool();

  try {
    await pool.query(`
      ALTER TABLE transit.import_runs
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    console.log("created_at fixed");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});