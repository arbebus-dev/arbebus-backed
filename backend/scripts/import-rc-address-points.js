const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const proj4 = require("proj4");
const { chain } = require("stream-chain");
const { parser } = require("stream-json");
const { pick } = require("stream-json/filters/pick");
const { streamArray } = require("stream-json/streamers/streamArray");
const { getPool } = require("../src/db/pool");

const ZIP_PATH =
  process.env.RC_ADDRESS_ZIP ||
  path.join(__dirname, "../data/adr_gra_adresai_LT.zip");

const BATCH_SIZE = Number(process.env.RC_IMPORT_BATCH_SIZE || 100);

proj4.defs(
  "EPSG:3346",
  "+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs",
);

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validLatLon(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= 53 &&
    lat <= 57 &&
    lon >= 20 &&
    lon <= 27
  );
}

function convertLks94ToWgs84(easting, northing) {
  const e = safeNumber(easting);
  const n = safeNumber(northing);
  if (!e || !n) return null;

  const [lon, lat] = proj4("EPSG:3346", "WGS84", [e, n]);
  if (!validLatLon(lat, lon)) return null;

  return { lat, lon };
}

async function openGeoJsonStream() {
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error(`Nerandu failo: ${ZIP_PATH}`);
  }

  const ext = path.extname(ZIP_PATH).toLowerCase();

  if (ext === ".json" || ext === ".geojson") {
    return fs.createReadStream(ZIP_PATH);
  }

  if (ext === ".zip") {
    const directory = await unzipper.Open.file(ZIP_PATH);
    const entry = directory.files.find((f) =>
      /\.(json|geojson)$/i.test(f.path),
    );

    if (!entry) {
      throw new Error("ZIP faile neradau .json arba .geojson failo");
    }

    return entry.stream();
  }

  throw new Error(`Nepalaikomas failo formatas: ${ext}`);
}

async function setup(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.addresses_rc_import (
      id BIGINT PRIMARY KEY,
      name TEXT,
      street TEXT,
      house_number TEXT,
      city TEXT,
      postcode TEXT,
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      location JSONB,
      source TEXT DEFAULT 'registru_centras',
      rc_object_id BIGINT,
      rc_aob_kodas BIGINT,
      rc_gyv_kodas BIGINT,
      rc_gat_kodas BIGINT
    );
  `);

  await pool.query(`TRUNCATE public.addresses_rc_import;`);
}

async function createIndexes(pool) {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_addresses_rc_import_street
    ON public.addresses_rc_import (lower(street));

    CREATE INDEX IF NOT EXISTS idx_addresses_rc_import_house
    ON public.addresses_rc_import (upper(house_number));

    CREATE INDEX IF NOT EXISTS idx_addresses_rc_import_city
    ON public.addresses_rc_import (lower(city));

    CREATE INDEX IF NOT EXISTS idx_addresses_rc_import_street_house_city
    ON public.addresses_rc_import (lower(street), upper(house_number), lower(city));

    CREATE INDEX IF NOT EXISTS idx_addresses_rc_import_lat_lon
    ON public.addresses_rc_import (lat, lon);
  `);

  await pool.query(`ANALYZE public.addresses_rc_import;`);
}

async function loadLookups(pool) {
  const gatves = new Map();
  const gyv = new Map();

  const gatvesResult = await pool.query(`
    SELECT
      "GAT_KODAS"::text AS code,
      NULLIF(TRIM("VARDAS_K"), '') AS name,
      COALESCE(NULLIF(TRIM("TIPO_SANTRUMPA"), ''), NULLIF(TRIM("TIPAS"), '')) AS type_short
    FROM public.adr_gatves
  `);

  for (const row of gatvesResult.rows) {
    const name = normalizeText(row.name);
    const type = normalizeText(row.type_short);
    const street = normalizeText([name, type].filter(Boolean).join(" "));
    if (row.code && street) gatves.set(row.code, street);
  }

  const gyvResult = await pool.query(`
    SELECT
      "GYV_KODAS"::text AS code,
      COALESCE(NULLIF(TRIM("VARDAS"), ''), NULLIF(TRIM("VARDAS_K"), '')) AS name
    FROM public.adr_gyvenvietoves
  `);

  for (const row of gyvResult.rows) {
    const city = normalizeText(row.name);
    if (row.code && city) gyv.set(row.code, city);
  }

  console.log(`Loaded street lookup: ${gatves.size}`);
  console.log(`Loaded city lookup: ${gyv.size}`);

  return { gatves, gyv };
}

async function insertBatch(pool, batch) {
  if (!batch.length) return;

  const values = [];
  const params = [];

  batch.forEach((row, i) => {
    const base = i * 13;
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13})`,
    );

    params.push(
      row.id,
      row.name,
      row.street,
      row.house_number,
      row.city,
      row.postcode,
      row.lat,
      row.lon,
      JSON.stringify({ latitude: row.lat, longitude: row.lon }),
      row.rc_object_id,
      row.rc_aob_kodas,
      row.rc_gyv_kodas,
      row.rc_gat_kodas,
    );
  });

  await pool.query(
    `
    INSERT INTO public.addresses_rc_import (
      id, name, street, house_number, city, postcode, lat, lon, location,
      rc_object_id, rc_aob_kodas, rc_gyv_kodas, rc_gat_kodas
    )
    VALUES ${values.join(",")}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      street = EXCLUDED.street,
      house_number = EXCLUDED.house_number,
      city = EXCLUDED.city,
      postcode = EXCLUDED.postcode,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      location = EXCLUDED.location,
      rc_object_id = EXCLUDED.rc_object_id,
      rc_aob_kodas = EXCLUDED.rc_aob_kodas,
      rc_gyv_kodas = EXCLUDED.rc_gyv_kodas,
      rc_gat_kodas = EXCLUDED.rc_gat_kodas
    `,
    params,
  );
}

async function main() {
  const pool = getPool();

  await setup(pool);
  const { gatves, gyv } = await loadLookups(pool);

  let batch = [];
  let imported = 0;
  let skipped = 0;

  const inputStream = await openGeoJsonStream();

  const stream = chain([
    inputStream,
    parser(),
    pick({ filter: "features" }),
    streamArray(),
  ]);

  for await (const { value } of stream) {
    const p = value.properties || {};
    const coords = value.geometry?.coordinates || [];

    const prop = (obj, names) => {
      for (const name of names) {
        if (obj[name] != null && obj[name] !== "") return obj[name];
      }

      const lowerMap = Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value]),
      );

      for (const name of names) {
        const value = lowerMap[String(name).toLowerCase()];
        if (value != null && value !== "") return value;
      }

      return null;
    };

    const id = safeNumber(prop(p, ["OBJECTID", "AOB_KODAS", "ID"]) || value.id);

    const gatCodeValue = prop(p, ["GAT_KODAS", "GAT_ID", "GATVES_KODAS"]);
    const gyvCodeValue = prop(p, ["GYV_KODAS", "GYV_ID", "GYVENVIETES_KODAS"]);

    const gatCode = gatCodeValue == null ? null : String(gatCodeValue);
    const gyvCode = gyvCodeValue == null ? null : String(gyvCodeValue);

    const street = gatCode ? gatves.get(gatCode) : null;
    const city = gyvCode ? gyv.get(gyvCode) : null;

    const house = normalizeText(
      prop(p, [
        "AOB_NR",
        "NAMO_NR",
        "PASTATO_NR",
        "NR",
        "NUMERIS",
        "NAMO_NUMERIS",
      ]) || String(prop(p, ["AOB_KODAS"]) || id || ""),
    );

    const postcode = normalizeText(p.PASTO_KODA || p.PASTO_KODAS || "");

    const lon = safeNumber(coords[0]);
    const lat = safeNumber(coords[1]);

    if (!lat || !lon) {
      skipped++;
      continue;
    }

    if (!id || !street || !city || !house || !lat || !lon) {
      skipped += 1;
      continue;
    }

    const name = normalizeText(`${street} ${house}, ${city}`);

    batch.push({
      id,
      name,
      street,
      house_number: house,
      city,
      postcode,
      lat,
      lon,
      rc_object_id: safeNumber(p.OBJECTID),
      rc_aob_kodas: safeNumber(p.AOB_KODAS),
      rc_gyv_kodas: safeNumber(p.GYV_KODAS),
      rc_gat_kodas: safeNumber(p.GAT_KODAS),
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(pool, batch);
      imported += batch.length;
      batch = [];
      console.log(`Imported: ${imported}, skipped: ${skipped}`);
    }
  }

  if (batch.length) {
    await insertBatch(pool, batch);
    imported += batch.length;
  }

  await createIndexes(pool);

  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
      )::int AS valid_coords
    FROM public.addresses_rc_import
  `);

  console.log("DONE", result.rows[0], { imported, skipped });
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
