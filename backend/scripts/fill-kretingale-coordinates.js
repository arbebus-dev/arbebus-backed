require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BATCH_LIMIT = Number(process.env.GEOCODE_BATCH_LIMIT || 300);
const DELAY_MS = Number(process.env.GEOCODE_DELAY_MS || 500);
const BATCH_PAUSE_MS = Number(process.env.GEOCODE_BATCH_PAUSE_MS || 1000);

const GOOGLE_KEY =
  process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isKretingaleCoordinate(lat, lon) {
  return lat >= 55.87 && lat <= 56.02 && lon >= 21.1 && lon <= 21.35;
}

function normalizeStreet(street) {
  const value = String(street || "").trim();
  if (!value) return "";

  if (
    /\b(g\.|g|gatvė|pr\.|prospektas|al\.|aikštė|skg\.|pl\.|plentas)$/i.test(
      value,
    )
  ) {
    return value;
  }

  return `${value} g.`;
}

function buildQueries(row) {
  const street = String(row.street || "").trim();
  const house = String(row.house_number || "").trim();
  const streetNorm = normalizeStreet(street);

  return [
    ...new Set([
      `${street} ${house}, Kretingalė, Lithuania`,
      `${streetNorm} ${house}, Kretingalė, Lithuania`,
      `${street} ${house}, Klaipėdos rajonas, Lithuania`,
      `${streetNorm} ${house}, Klaipėdos rajonas, Lithuania`,
    ]),
  ];
}

async function geocodeGoogle(query) {
  if (!GOOGLE_KEY || GOOGLE_KEY === "TEST") return null;

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({
      address: query,
      key: GOOGLE_KEY,
      region: "lt",
      language: "lt",
    }).toString();

  const res = await fetch(url);
  const json = await res.json();

  if (json.status && json.status !== "OK") {
    console.log(`Google ${json.status}: ${query}`);
    return null;
  }

  const loc = json.results?.[0]?.geometry?.location;
  if (!loc) return null;

  const lat = Number(loc.lat);
  const lon = Number(loc.lng);

  if (!isKretingaleCoordinate(lat, lon)) return null;

  return { lat, lon, provider: "google" };
}

async function geocodeSmart(row) {
  for (const query of buildQueries(row)) {
    console.log("Trying:", query);

    const result = await geocodeGoogle(query);
    if (result) return { ...result, query };

    await sleep(DELAY_MS);
  }

  return null;
}

async function fetchBatch(client) {
  const { rows } = await client.query(
    `
    SELECT id, street, house_number, city
    FROM public.addresses
    WHERE city ILIKE '%kretingal%'
      AND (lat = 0 OR lon = 0 OR lat IS NULL OR lon IS NULL)
      AND street IS NOT NULL
      AND house_number IS NOT NULL
    ORDER BY street ASC, house_number ASC
    LIMIT $1
    `,
    [BATCH_LIMIT],
  );

  return rows;
}

async function getProgress(client) {
  const { rows } = await client.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE lat != 0 AND lon != 0) AS filled,
      COUNT(*) FILTER (WHERE lat = 0 OR lon = 0 OR lat IS NULL OR lon IS NULL) AS missing
    FROM public.addresses
    WHERE city ILIKE '%kretingal%'
  `);

  return rows[0];
}

async function main() {
  const client = await pool.connect();

  let totalUpdated = 0;
  let totalFailed = 0;
  let batchNumber = 0;

  try {
    while (true) {
      batchNumber += 1;

      const progressBefore = await getProgress(client);
      console.log("Progress before batch:", progressBefore);

      const rows = await fetchBatch(client);

      if (rows.length === 0) {
        console.log("DONE ALL KRETINGALE ADDRESSES.");
        break;
      }

      console.log(
        `Batch ${batchNumber}: found ${rows.length} Kretingale addresses`,
      );

      let batchUpdated = 0;
      let batchFailed = 0;

      for (const row of rows) {
        const label = `${row.street} ${row.house_number}, ${row.city}`;

        try {
          const result = await geocodeSmart(row);

          if (!result) {
            batchFailed += 1;
            totalFailed += 1;
            console.log("FAILED:", label);

            await client.query(
              `UPDATE public.addresses SET lat = NULL, lon = NULL WHERE id = $1`,
              [row.id],
            );

            continue;
          }

          await client.query(
            `UPDATE public.addresses SET lat = $1, lon = $2 WHERE id = $3`,
            [result.lat, result.lon, row.id],
          );

          batchUpdated += 1;
          totalUpdated += 1;

          console.log(
            `UPDATED: ${label} → ${result.lat}, ${result.lon} (${result.provider}) via ${result.query}`,
          );
        } catch (error) {
          batchFailed += 1;
          totalFailed += 1;
          console.error("ERROR:", label, error.message);
        }

        await sleep(DELAY_MS);
      }

      const progressAfter = await getProgress(client);

      console.log("Batch done.");
      console.log({
        batchNumber,
        batchUpdated,
        batchFailed,
        totalUpdated,
        totalFailed,
        progressAfter,
      });

      await sleep(BATCH_PAUSE_MS);
    }

    console.log("FINAL DONE.");
    console.log({ totalUpdated, totalFailed });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
