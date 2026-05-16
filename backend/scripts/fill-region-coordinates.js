require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BATCH_LIMIT = Number(process.env.GEOCODE_BATCH_LIMIT || 100);
const DELAY_MS = Number(process.env.GEOCODE_DELAY_MS || 1800);
const BATCH_PAUSE_MS = Number(process.env.GEOCODE_BATCH_PAUSE_MS || 5000);

const GOOGLE_KEY =
  process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

const REGION_CITY_PATTERNS = [
  "%klaip%",
  "%nering%",
  "%nida%",
  "%gargžd%",
  "%priekul%",
  "%drevern%",
  "%karkl%",
  "%sleng%",
  "%sendvar%",
  "%kretingal%",
  "%dovil%",
  "%veivirž%",
  "%judrėn%",
  "%agluonėn%",
  "%ketverg%",
  "%lapiai%",
  "%pliki%",
  "%endriejav%",
  "%venck%",
  "%saug%",
  "%girul%",
  "%melnrag%",
  "%smiltyn%",
  "%juodkrant%",
  "%preil%",
  "%pervalk%",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWesternLithuania(lat, lon) {
  return lat >= 55.1 && lat <= 56.2 && lon >= 20.4 && lon <= 22.8;
}

function normalizeCity(city) {
  const v = String(city || "").toLowerCase();

  if (v.includes("nering")) return "Neringa";
  if (v.includes("nida")) return "Nida";
  if (v.includes("gargžd")) return "Gargždai";
  if (v.includes("priekul")) return "Priekulė";
  if (v.includes("drevern")) return "Dreverna";
  if (v.includes("karkl")) return "Karklė";
  if (v.includes("sleng")) return "Slengiai";
  if (v.includes("sendvar")) return "Sendvaris";
  if (v.includes("kretingal")) return "Kretingalė";
  if (v.includes("dovil")) return "Dovilai";
  if (v.includes("klaip")) return "Klaipėda";

  return city || "Klaipėda";
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
  const city = String(row.city || "").trim();
  const normalizedStreet = normalizeStreet(street);
  const normalizedCity = normalizeCity(city);

  return [
    ...new Set(
      [
        `${street} ${house}, ${city}, Lithuania`,
        `${normalizedStreet} ${house}, ${city}, Lithuania`,
        `${street} ${house}, ${normalizedCity}, Lithuania`,
        `${normalizedStreet} ${house}, ${normalizedCity}, Lithuania`,

        `${street} ${house}, Klaipėdos rajonas, Lithuania`,
        `${normalizedStreet} ${house}, Klaipėdos rajonas, Lithuania`,

        `${street} ${house}, Neringa, Lithuania`,
        `${normalizedStreet} ${house}, Neringa, Lithuania`,

        `${street} ${house}, Nida, Lithuania`,
        `${normalizedStreet} ${house}, Nida, Lithuania`,

        `${street} ${house}, Gargždai, Lithuania`,
        `${normalizedStreet} ${house}, Gargždai, Lithuania`,

        `${street} ${house}, Priekulė, Lithuania`,
        `${normalizedStreet} ${house}, Priekulė, Lithuania`,

        `${street} ${house}, Dreverna, Lithuania`,
        `${normalizedStreet} ${house}, Dreverna, Lithuania`,

        `${street} ${house}, Karklė, Lithuania`,
        `${normalizedStreet} ${house}, Karklė, Lithuania`,
      ].filter(Boolean),
    ),
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

  const first = json.results?.[0];
  const loc = first?.geometry?.location;
  if (!loc) return null;

  const lat = Number(loc.lat);
  const lon = Number(loc.lng);

  if (!isWesternLithuania(lat, lon)) return null;

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
    }).toString();

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Arbebus/1.0 arbebuss@gmail.com",
      Accept: "application/json",
    },
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log("OSM returned non-JSON, skipping:", query);
    return null;
  }

  const first = json?.[0];
  if (!first) return null;

  const lat = Number(first.lat);
  const lon = Number(first.lon);

  if (!isWesternLithuania(lat, lon)) return null;

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
    console.log("Trying:", query);

    const result = await geocodeOne(query);
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
    WHERE city ILIKE ANY($1::text[])
      AND (lat = 0 OR lon = 0 OR lat IS NULL OR lon IS NULL)
      AND street IS NOT NULL
      AND house_number IS NOT NULL
    ORDER BY city ASC, street ASC, house_number ASC
    LIMIT $2
    `,
    [REGION_CITY_PATTERNS, BATCH_LIMIT],
  );

  return rows;
}

async function getProgress(client) {
  const { rows } = await client.query(
    `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE lat != 0 AND lon != 0) AS filled,
      COUNT(*) FILTER (WHERE lat = 0 OR lon = 0 OR lat IS NULL OR lon IS NULL) AS missing
    FROM public.addresses
    WHERE city ILIKE ANY($1::text[])
    `,
    [REGION_CITY_PATTERNS],
  );

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
        console.log("DONE ALL REGION ADDRESSES.");
        break;
      }

      console.log(
        `Batch ${batchNumber}: found ${rows.length} region addresses`,
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

            // Mark as NULL so script will not loop forever on the same impossible address.
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
