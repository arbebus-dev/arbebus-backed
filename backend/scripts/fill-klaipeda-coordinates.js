require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BATCH_LIMIT = Number(process.env.GEOCODE_BATCH_LIMIT || 300);
const DELAY_MS = Number(process.env.GEOCODE_DELAY_MS || 900);

const GOOGLE_KEY =
  process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isKlaipedaRegionCoordinate(lat, lon) {
  return lat >= 55.3 && lat <= 56.0 && lon >= 20.5 && lon <= 21.8;
}

function normalizeCity(city) {
  const value = String(city || "").toLowerCase();
  if (value.includes("klaip")) return "Klaipėda";
  return city || "Klaipėda";
}

function cleanStreet(street) {
  return String(street || "")
    .replace(/\s+/g, " ")
    .replace(/\bgatvė\b/gi, "")
    .replace(/\bg\.\b/gi, "")
    .replace(/\bplentas\b/gi, "")
    .replace(/\bpl\.\b/gi, "")
    .replace(/\bprospektas\b/gi, "")
    .replace(/\bpr\.\b/gi, "")
    .trim();
}

function buildQueries(row) {
  const base = cleanStreet(row.street);
  const house = String(row.house_number || "").trim();
  const city = normalizeCity(row.city);

  const variants = [
    `${base} ${house}, ${city}, Lithuania`,
    `${base} g. ${house}, ${city}, Lithuania`,
    `${base} gatvė ${house}, ${city}, Lithuania`,
    `${base} pl. ${house}, ${city}, Lithuania`,
    `${base} plentas ${house}, ${city}, Lithuania`,
    `${base} pr. ${house}, ${city}, Lithuania`,
    `${base} prospektas ${house}, ${city}, Lithuania`,
    `${base} ${house}, Klaipėdos rajonas, Lithuania`,
  ];

  return [...new Set(variants.filter(Boolean))];
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

  const first = json.results?.[0];
  const loc = first?.geometry?.location;

  if (!loc) return null;

  const lat = Number(loc.lat);
  const lon = Number(loc.lng);

  if (!isKlaipedaRegionCoordinate(lat, lon)) return null;

  return {
    lat,
    lon,
    provider: "google",
    formatted: first.formatted_address,
  };
}

async function geocodeOSM(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      countrycodes: "lt",
      addressdetails: "1",
    }).toString();

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Arbebus/1.0 arbebus@gmail.com",
      Accept: "application/json",
    },
  });

  const json = await res.json();
  const first = json?.[0];

  if (!first) return null;

  const lat = Number(first.lat);
  const lon = Number(first.lon);

  if (!isKlaipedaRegionCoordinate(lat, lon)) return null;

  return {
    lat,
    lon,
    provider: "osm",
    formatted: first.display_name,
  };
}

async function geocodeOne(query) {
  const google = await geocodeGoogle(query);
  if (google) return google;

  return geocodeOSM(query);
}

async function geocodeSmart(row) {
  const queries = buildQueries(row);

  for (const query of queries) {
    console.log(`Trying: ${query}`);

    const result = await geocodeOne(query);
    if (result) {
      return { ...result, query };
    }

    await sleep(DELAY_MS);
  }

  return null;
}

async function main() {
  const client = await pool.connect();

  let totalUpdated = 0;
  let totalFailed = 0;
  let batchNumber = 0;

  try {
    while (true) {
      batchNumber += 1;

      const { rows } = await client.query(
        `
        SELECT id, street, house_number, city, lat, lon
        FROM public.addresses
        WHERE city ILIKE '%klaip%'
          AND (lat = 0 OR lon = 0 OR lat IS NULL OR lon IS NULL)
          AND street IS NOT NULL
          AND house_number IS NOT NULL
        ORDER BY street ASC, house_number ASC
        LIMIT $1
        `,
        [BATCH_LIMIT],
      );

      if (rows.length === 0) {
        console.log("DONE ALL Klaipeda addresses.");
        break;
      }

      console.log(`Batch ${batchNumber}: found ${rows.length} addresses.`);

      let batchUpdated = 0;
      let batchFailed = 0;

      for (const row of rows) {
        const label = `${row.street} ${row.house_number}, ${row.city}`;

        try {
          console.log(`Geocoding smart: ${label}`);

          const result = await geocodeSmart(row);

          if (!result) {
            batchFailed += 1;
            totalFailed += 1;
            console.log(`FAILED ALL VARIANTS: ${label}`);

            await client.query(
              `
              UPDATE public.addresses
              SET lat = NULL,
                  lon = NULL
              WHERE id = $1
              `,
              [row.id],
            );

            continue;
          }

          await client.query(
            `
            UPDATE public.addresses
            SET lat = $1,
                lon = $2
            WHERE id = $3
            `,
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
          console.error(`ERROR: ${label}`, error.message);
        }

        await sleep(DELAY_MS);
      }

      console.log("Batch done.");
      console.log({
        batchNumber,
        batchUpdated,
        batchFailed,
        totalUpdated,
        totalFailed,
      });
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
