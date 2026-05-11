const { normalizeText } = require("../utils/normalizeText");
const { toResult } = require("../utils/mapSearchResult");
const { getPool } = require("../../../db/pool");

const STREETS = [
  {
    names: ["taikos pr", "taikos prospektas", "taikos"],
    title: "Taikos pr.",
    lat: 55.6909,
    lon: 21.1567,
  },
  {
    names: [
      "herkaus manto g",
      "h manto g",
      "h manto",
      "manto g",
      "herkaus manto",
    ],
    title: "H. Manto g.",
    lat: 55.7212,
    lon: 21.1289,
  },
  {
    names: ["liepu g", "liepu", "liepų g", "liepų"],
    title: "Liepų g.",
    lat: 55.7114,
    lon: 21.1371,
  },
  {
    names: ["tilzes g", "tilzes", "tilžės g", "tilžės"],
    title: "Tilžės g.",
    lat: 55.6981,
    lon: 21.1617,
  },
  {
    names: ["minijos g", "minijos"],
    title: "Minijos g.",
    lat: 55.6819,
    lon: 21.1513,
  },
  {
    names: ["silutes pl", "silutes plentas", "šilutės pl", "šilutės plentas"],
    title: "Šilutės pl.",
    lat: 55.6751,
    lon: 21.1766,
  },
  {
    names: ["baltijos pr", "baltijos prospektas", "baltijos"],
    title: "Baltijos pr.",
    lat: 55.6815,
    lon: 21.1644,
  },
  {
    names: ["smilteles g", "smilteles", "smiltelės g", "smiltelės"],
    title: "Smiltelės g.",
    lat: 55.6584,
    lon: 21.1794,
  },
  {
    names: ["statybininku pr", "statybininku prospektas", "statybininkų pr"],
    title: "Statybininkų pr.",
    lat: 55.6658,
    lon: 21.1785,
  },
  {
    names: ["debreceno g", "debreceno", "debre ceno g", "debre ceno"],
    title: "Debreceno g.",
    lat: 55.6727,
    lon: 21.1805,
  },
  {
    names: ["mokyklos g", "mokyklos"],
    title: "Mokyklos g.",
    lat: 55.7019,
    lon: 21.1605,
  },
  {
    names: ["kretingos g", "kretingos"],
    title: "Kretingos g.",
    lat: 55.7345,
    lon: 21.1304,
  },
  {
    names: ["priestocio g", "priestocio", "priešstočio g", "priešstočio"],
    title: "Priestočio g.",
    lat: 55.7173,
    lon: 21.1398,
  },
  {
    names: ["naujojo sodo g", "naujojo sodo"],
    title: "Naujojo Sodo g.",
    lat: 55.7106,
    lon: 21.1341,
  },
  {
    names: ["jurininku pr", "jūrininkų pr", "jurininku", "jūrininkų"],
    title: "Jūrininkų pr.",
    lat: 55.6547,
    lon: 21.1819,
  },
  {
    names: ["mogiliovo g", "mogiliovo"],
    title: "Mogiliovo g.",
    lat: 55.6578,
    lon: 21.1905,
  },
  {
    names: ["vingio g", "vingio"],
    title: "Vingio g.",
    lat: 55.6559,
    lon: 21.1772,
  },
  {
    names: ["laukininku g", "laukininkų g", "laukininku", "laukininkų"],
    title: "Laukininkų g.",
    lat: 55.6546,
    lon: 21.1878,
  },
  {
    names: ["reikjaviko g", "reikjaviko"],
    title: "Reikjaviko g.",
    lat: 55.6526,
    lon: 21.1818,
  },
  {
    names: ["savanoriu pr", "savanorių pr", "savanoriu", "savanorių"],
    title: "Savanorių pr.",
    lat: 55.7299,
    lon: 21.1285,
  },
];

let lastDbError = null;
let lastDbCount = null;
let lastDbHealthCheck = 0;

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function compactQuery(value) {
  return normalizeText(value).replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

function normalizeStreetPart(value) {
  return compactQuery(value)
    .replace(/\b(g|gatve|gatvė|pr|prospektas|pl|plentas)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesStreet(query, street) {
  const q = compactQuery(query);
  return street.names.some((name) => {
    const n = compactQuery(name);
    return q.includes(n) || n.includes(q);
  });
}

function localStreetFallback(query, options = {}) {
  const q = String(query || "").trim();
  const nq = compactQuery(q);
  if (nq.length < 3) return [];

  const house = extractHouseNumber(q);
  const limit = Math.min(Math.max(Number(options.limit || 6), 1), 10);
  const results = [];

  for (const street of STREETS) {
    if (!matchesStreet(q, street)) continue;

    const exactTitle = house ? `${street.title} ${house}` : street.title;

    results.push(
      toResult({
        id: `local-street-${compactQuery(exactTitle).replace(/\s+/g, "-")}`,
        type: "street",
        title: exactTitle,
        subtitle: house
          ? "Gatvė rasta – tikslus namo adresas tikrinamas duomenų bazėje"
          : "Įvesk namo numerį, pvz. Taikos pr. 8",
        latitude: street.lat,
        longitude: street.lon,
        source: "local_address_fallback",
        category: "Gatvė",
        priority: house ? 35 : 90,
        score: house ? 120 : 240,
        selectable: false,
        requiresHouseNumber: true,
        keywords: [
          street.title,
          ...street.names,
          "Klaipėda",
          "adresas",
          "gatvė",
        ],
      }),
    );
  }

  return results.slice(0, limit);
}

function rowToAddressResult(row, query) {
  const title =
    row.name || [row.street, row.house_number].filter(Boolean).join(" ");
  const subtitle = [row.city, row.postcode].filter(Boolean).join(", ");
  const exactHouse = extractHouseNumber(query);

  return toResult({
    id: `address-${row.id}`,
    type: "address",
    title,
    name: title,
    subtitle,
    latitude: Number(row.lat || 0),
    longitude: Number(row.lon || 0),
    source: "postgres_address",
    category: "Adresas",
    priority: exactHouse ? 260 : 180,
    score: Number(row.rank_score || 0),
    selectable: true,
    requiresHouseNumber: false,
    keywords: [
      row.name,
      row.street,
      row.house_number,
      row.city,
      row.postcode,
    ].filter(Boolean),
  });
}

async function searchPostgresAddresses(query, options = {}) {
  const q = String(query || "").trim();
  const nq = compactQuery(q);
  if (nq.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
  const house = extractHouseNumber(q);
  const pool = getPool();

  const streetPartRaw = nq.replace(/\b\d+[a-z]?\b/gi, "").trim();
  const streetPart = normalizeStreetPart(streetPartRaw || nq);

  const sql = `
    SELECT
      id,
      name,
      street,
      house_number,
      city,
      postcode,
      lat,
      lon,
      (
        similarity(COALESCE(name, ''), $1) * 1000 +
        similarity(COALESCE(street, ''), $2) * 900 +
        CASE
          WHEN COALESCE(name, '') ILIKE $1 || '%' THEN 1800
          ELSE 0
        END +
        CASE
          WHEN COALESCE(street, '') ILIKE $2 || '%' THEN 1600
          ELSE 0
        END +
        CASE
          WHEN $3::text IS NOT NULL
            AND UPPER(COALESCE(house_number, '')) = UPPER($3::text)
          THEN 5000
          ELSE 0
        END +
        CASE
          WHEN $3::text IS NOT NULL
            AND UPPER(COALESCE(house_number, '')) ILIKE UPPER($3::text) || '%'
          THEN 1800
          ELSE 0
        END
      ) AS rank_score
    FROM public.addresses
    WHERE
      COALESCE(name, '') % $1
      OR COALESCE(street, '') % $2
      OR COALESCE(name, '') ILIKE $1 || '%'
      OR COALESCE(street, '') ILIKE $2 || '%'
      OR (
        $3::text IS NOT NULL
        AND COALESCE(street, '') % $2
        AND UPPER(COALESCE(house_number, '')) ILIKE UPPER($3::text) || '%'
      )
    ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
    LIMIT $4
  `;

  await pool.query("SET pg_trgm.similarity_threshold = 0.12");

  const result = await pool.query(sql, [q, streetPart || nq, house, limit]);
  return result.rows.map((row) => rowToAddressResult(row, q)).filter(Boolean);
}

async function searchLocalAddresses(query, options = {}) {
  const fallback = localStreetFallback(query, options);

  try {
    const dbResults = await searchPostgresAddresses(query, options);
    lastDbError = null;
    return dbResults.length ? dbResults : fallback;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return fallback;
  }
}

async function refreshDbCount() {
  if (Date.now() - lastDbHealthCheck < 30000) return lastDbCount;
  lastDbHealthCheck = Date.now();

  try {
    const result = await getPool().query(
      "SELECT COUNT(*)::int AS count FROM public.addresses",
    );
    lastDbCount = Number(result.rows?.[0]?.count || 0);
    lastDbError = null;
  } catch (error) {
    lastDbError = error?.message || String(error);
  }

  return lastDbCount;
}

function localAddressHealth() {
  refreshDbCount().catch(() => undefined);

  return {
    localAddressItems: STREETS.length,
    postgresAddressProvider: true,
    postgresAddressCount: lastDbCount,
    postgresAddressError: lastDbError,
  };
}

module.exports = { searchLocalAddresses, localAddressHealth };
