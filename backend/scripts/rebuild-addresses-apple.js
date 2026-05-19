const { getPool } = require('../src/db/pool');

const CANDIDATE_TABLES = [
  'adr_adresai',
  'adr_aob',
  'adr_stat',
  'adr_pat',
  'addresses_rc_import',
];

const HOUSE_COLUMNS = [
  'NAMO_NR',
  'NAMO_NUMERIS',
  'AOB_NR',
  'PASTATO_NR',
  'STATINIO_NR',
  'STAT_NR',
  'NR',
  'NUMERIS',
  'ADRESO_NR',
  'NAMAS',
];

const AOB_COLUMNS = ['AOB_KODAS', 'AOB_ID', 'ADRESO_KODAS', 'OBJECTID', 'ID'];
const GAT_COLUMNS = ['GAT_KODAS', 'GAT_ID', 'GATVES_KODAS'];
const GYV_COLUMNS = ['GYV_KODAS', 'GYV_ID', 'GYVENVIETES_KODAS'];
const POST_COLUMNS = ['PASTO_KODA', 'PASTO_KODAS', 'POSTCODE'];
const LAT_COLUMNS = ['LAT', 'N_KOORD', 'latitude'];
const LON_COLUMNS = ['LON', 'E_KOORD', 'longitude'];

function qid(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function normalizeKey(value) {
  return String(value || '').toLowerCase();
}

function pickColumn(columns, names) {
  const byLower = new Map(columns.map((c) => [normalizeKey(c), c]));
  for (const name of names) {
    const found = byLower.get(normalizeKey(name));
    if (found) return found;
  }
  return null;
}

async function tableExists(pool, table) {
  const res = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table],
  );
  return Boolean(res.rows?.[0]?.exists);
}

async function tableColumns(pool, table) {
  const res = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return res.rows.map((r) => r.column_name);
}

async function chooseSource(pool) {
  const diagnostics = [];

  for (const table of CANDIDATE_TABLES) {
    if (!(await tableExists(pool, table))) continue;

    const columns = await tableColumns(pool, table);
    const house = pickColumn(columns, HOUSE_COLUMNS);
    const aob = pickColumn(columns, AOB_COLUMNS);
    const gat = pickColumn(columns, GAT_COLUMNS);
    const gyv = pickColumn(columns, GYV_COLUMNS);
    const post = pickColumn(columns, POST_COLUMNS);
    const lat = pickColumn(columns, LAT_COLUMNS);
    const lon = pickColumn(columns, LON_COLUMNS);

    diagnostics.push({ table, columns, house, aob, gat, gyv, post, lat, lon });

    // addresses_rc_import is the coordinate/import helper. It is not a clean source
    // for real house numbers, because older imports may contain RC object ids there.
    if (house && (aob || (gat && gyv)) && table !== 'addresses_rc_import') {
      return { table, columns, house, aob, gat, gyv, post, lat, lon, diagnostics };
    }
  }

  console.error('\n[ADDRESS REBUILD] No clean house-number source table found.');
  console.error('[ADDRESS REBUILD] Available candidates:');
  for (const item of diagnostics) {
    console.error(
      `- ${item.table}: house=${item.house || '-'} aob=${item.aob || '-'} gat=${item.gat || '-'} gyv=${item.gyv || '-'} lat=${item.lat || '-'} lon=${item.lon || '-'}`,
    );
    console.error(`  columns: ${item.columns.join(', ')}`);
  }
  throw new Error('NO_CLEAN_ADDRESS_SOURCE_TABLE');
}

function houseCleanSql(expr) {
  return `upper(regexp_replace(trim(${expr}::text), '\\s+', '', 'g'))`;
}

function validHouseSql(expr) {
  const h = houseCleanSql(expr);
  return `(
    ${expr} IS NOT NULL
    AND ${h} <> ''
    AND ${h} ~ '^[0-9]{1,4}[A-ZĄČĘĖĮŠŲŪŽ]?$|^[0-9]{1,4}[A-ZĄČĘĖĮŠŲŪŽ]?[-/][0-9]{1,4}[A-ZĄČĘĖĮŠŲŪŽ]?$'
    AND NOT (${h} ~ '^[0-9]{5,}$')
  )`;
}

function codeCompare(left, right) {
  return `${left}::text = ${right}::text`;
}

async function rebuild() {
  const pool = getPool();
  const source = await chooseSource(pool);

  console.log('[ADDRESS REBUILD] Using source:', {
    table: source.table,
    house: source.house,
    aob: source.aob,
    gat: source.gat,
    gyv: source.gyv,
    post: source.post,
    lat: source.lat,
    lon: source.lon,
  });

  const src = 's';
  const point = 'p';
  const streetLookup = 'g';
  const cityLookup = 'y';

  const houseExpr = `${src}.${qid(source.house)}`;
  const house = houseCleanSql(houseExpr);

  const sourceAobExpr = source.aob ? `${src}.${qid(source.aob)}` : 'NULL';
  const sourceGatExpr = source.gat ? `${src}.${qid(source.gat)}` : 'NULL';
  const sourceGyvExpr = source.gyv ? `${src}.${qid(source.gyv)}` : 'NULL';
  const postExpr = source.post
    ? `NULLIF(trim(${src}.${qid(source.post)}::text), '')`
    : `${point}.postcode`;

  const streetExpr = `trim(regexp_replace(concat_ws(' ', NULLIF(${streetLookup}."VARDAS_K"::text, ''), COALESCE(NULLIF(${streetLookup}."TIPO_SANTRUMPA"::text, ''), NULLIF(${streetLookup}."TIPAS"::text, ''))), '\\s+', ' ', 'g'))`;
  const cityExpr = `trim(COALESCE(NULLIF(${cityLookup}."VARDAS"::text, ''), NULLIF(${cityLookup}."VARDAS_K"::text, '')))`;

  const latExpr = source.lat
    ? `${src}.${qid(source.lat)}::double precision`
    : `${point}.lat::double precision`;
  const lonExpr = source.lon
    ? `${src}.${qid(source.lon)}::double precision`
    : `${point}.lon::double precision`;

  const joinPoint = source.aob
    ? `LEFT JOIN public.addresses_rc_import ${point} ON ${codeCompare(`${point}.rc_aob_kodas`, sourceAobExpr)} OR ${codeCompare(`${point}.id`, sourceAobExpr)}`
    : `LEFT JOIN public.addresses_rc_import ${point} ON false`;

  const joinStreet = source.gat
    ? `LEFT JOIN public.adr_gatves ${streetLookup} ON ${codeCompare(`${streetLookup}."GAT_KODAS"`, sourceGatExpr)}`
    : `LEFT JOIN public.adr_gatves ${streetLookup} ON ${codeCompare(`${streetLookup}."GAT_KODAS"`, `${point}.rc_gat_kodas`)}`;

  const joinCity = source.gyv
    ? `LEFT JOIN public.adr_gyvenvietoves ${cityLookup} ON ${codeCompare(`${cityLookup}."GYV_KODAS"`, sourceGyvExpr)}`
    : `LEFT JOIN public.adr_gyvenvietoves ${cityLookup} ON ${codeCompare(`${cityLookup}."GYV_KODAS"`, `${point}.rc_gyv_kodas`)}`;

  const idExpr = source.aob ? sourceAobExpr : `${src}.ctid::text`;

  await pool.query('BEGIN');
  try {
    await pool.query('DROP TABLE IF EXISTS public.addresses_clean_next;');
    await pool.query(`
      CREATE TABLE public.addresses_clean_next (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        street TEXT NOT NULL,
        house_number TEXT NOT NULL,
        city TEXT NOT NULL,
        postcode TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lon DOUBLE PRECISION NOT NULL,
        location JSONB,
        source TEXT DEFAULT 'registru_centras_clean',
        rc_aob_kodas BIGINT,
        rc_gat_kodas BIGINT,
        rc_gyv_kodas BIGINT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await pool.query(`
      INSERT INTO public.addresses_clean_next (
        id, name, street, house_number, city, postcode, lat, lon, location,
        rc_aob_kodas, rc_gat_kodas, rc_gyv_kodas
      )
      SELECT DISTINCT ON (lower(street), upper(house_number), lower(city))
        concat_ws(':', 'rc', source_id::text, house_number) AS id,
        concat_ws(', ', concat_ws(' ', street, house_number), city) AS name,
        street,
        house_number,
        city,
        postcode,
        lat,
        lon,
        jsonb_build_object('latitude', lat, 'longitude', lon) AS location,
        NULLIF(rc_aob_kodas::text, '')::bigint AS rc_aob_kodas,
        NULLIF(rc_gat_kodas::text, '')::bigint AS rc_gat_kodas,
        NULLIF(rc_gyv_kodas::text, '')::bigint AS rc_gyv_kodas
      FROM (
        SELECT
          ${idExpr} AS source_id,
          ${streetExpr} AS street,
          ${house} AS house_number,
          ${cityExpr} AS city,
          ${postExpr} AS postcode,
          ${latExpr} AS lat,
          ${lonExpr} AS lon,
          ${sourceAobExpr} AS rc_aob_kodas,
          ${sourceGatExpr} AS rc_gat_kodas,
          ${sourceGyvExpr} AS rc_gyv_kodas
        FROM public.${qid(source.table)} s
        ${joinPoint}
        ${joinStreet}
        ${joinCity}
        WHERE ${validHouseSql(houseExpr)}
      ) cleaned
      WHERE street IS NOT NULL AND street <> ''
        AND city IS NOT NULL AND city <> ''
        AND lat BETWEEN 53 AND 57
        AND lon BETWEEN 20 AND 27
      ORDER BY lower(street), upper(house_number), lower(city), source_id;
    `);

    const count = await pool.query('SELECT COUNT(*)::int AS count FROM public.addresses_clean_next;');
    const total = Number(count.rows?.[0]?.count || 0);
    if (total < 1000) {
      throw new Error(`ADDRESS_REBUILD_TOO_FEW_ROWS:${total}`);
    }

    await pool.query('DROP TABLE IF EXISTS public.addresses_backup_before_clean;');
    await pool.query('ALTER TABLE IF EXISTS public.addresses RENAME TO addresses_backup_before_clean;');
    await pool.query('ALTER TABLE public.addresses_clean_next RENAME TO addresses;');

    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_lower_name_pattern ON public.addresses (lower(name) text_pattern_ops);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_lower_street_pattern ON public.addresses (lower(street) text_pattern_ops);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_lower_city_pattern ON public.addresses (lower(city) text_pattern_ops);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_lower_house_number ON public.addresses (lower(house_number));');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_street_house_city ON public.addresses (lower(street), lower(house_number), lower(city));');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_lower_name_gist_trgm ON public.addresses USING gist (lower(name) gist_trgm_ops);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_lower_street_gist_trgm ON public.addresses USING gist (lower(street) gist_trgm_ops);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_name_gin_trgm ON public.addresses USING gin (name gin_trgm_ops);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_street_gin_trgm ON public.addresses USING gin (street gin_trgm_ops);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_valid_lat_lon ON public.addresses (lat, lon);');
    await pool.query('ANALYZE public.addresses;');

    await pool.query('COMMIT');
    console.log('[ADDRESS REBUILD] DONE', { count: total, table: 'public.addresses' });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

rebuild().catch((error) => {
  console.error('[ADDRESS REBUILD] FAILED:', error.message || error);
  process.exit(1);
});
