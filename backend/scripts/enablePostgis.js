require("dotenv").config();
const { getPool } = require("../db/pool");

(async () => {
  const pool = getPool();

  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    console.log("✅ PostGIS enabled");

    const res = await pool.query(`SELECT postgis_version()`);
    console.log(res.rows[0]);

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();