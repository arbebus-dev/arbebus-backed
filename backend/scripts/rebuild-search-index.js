/* eslint-env node */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MEILI_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY || process.env.MEILI_API_KEY || 'ArbebusMasterKey2026';
const INDEX = process.env.MEILI_INDEX || 'places';

function readJson(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(text || '[]');
  } catch (error) {
    console.warn('[index] failed to read JSON', filePath, error.message);
    return fallback;
  }
}

function parseCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header.trim()] = values[index] ?? '';
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && next === '"') {
      cur += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ą/g, 'a')
    .replace(/č/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ė/g, 'e')
    .replace(/į/g, 'i')
    .replace(/š/g, 's')
    .replace(/ų/g, 'u')
    .replace(/ū/g, 'u')
    .replace(/ž/g, 'z')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function baseDoc(input, fallbackType = 'place') {
  const latitude = toNumber(input.latitude ?? input.lat ?? input.stop_lat);
  const longitude = toNumber(input.longitude ?? input.lng ?? input.lon ?? input.stop_lon);
  const name = String(input.name || input.title || input.stop_name || input.full_address || input.fullAddress || input.address || '').trim();
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const type = String(input.type || fallbackType).toLowerCase();
  const address = String(input.address || input.subtitle || input.full_address || input.fullAddress || '').trim();
  const aliases = Array.isArray(input.aliases) ? input.aliases : Array.isArray(input.keywords) ? input.keywords : [];
  return {
    id: String(input.id || input.stop_id || `${type}-${normalizeText(name)}-${latitude}-${longitude}`).slice(0, 180),
    type,
    name,
    title: name,
    address,
    fullAddress: address || name,
    municipality: input.municipality || input.savivaldybe || input.savivaldybė || '',
    settlement: input.settlement || input.gyvenviete || input.gyvenvietė || '',
    street: input.street || input.gatve || input.gatvė || '',
    houseNumber: input.house_number || input.houseNumber || input.namo_numeris || '',
    category: input.category || type,
    aliases,
    keywords: aliases,
    priority: Number(input.priority ?? (type === 'address' ? 1000 : type === 'poi' ? 700 : type === 'stop' ? 350 : 500)),
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    source: input.source || (type === 'address' ? 'official_address' : 'local_index'),
    searchText: normalizeText([name, address, aliases.join(' ')].join(' ')),
  };
}

function loadAddresses() {
  const file = path.join(ROOT, 'data', 'addresses', 'klaipeda-addresses.csv');
  if (!fs.existsSync(file)) return [];
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  return rows.map((row) => baseDoc({
    ...row,
    id: row.id || row.address_id,
    name: row.name || row.full_address || row.fullAddress || row.pilnas_adresas,
    address: row.address || row.full_address || row.fullAddress || row.pilnas_adresas,
    latitude: row.latitude || row.lat,
    longitude: row.longitude || row.lng || row.lon,
    type: 'address',
    priority: 1000,
    source: 'official_address',
  }, 'address')).filter(Boolean);
}

function loadPoi() {
  const dir = path.join(ROOT, 'src', 'data', 'poi');
  const files = [
    'priorityPois.json',
    'shoppingCenters.json',
    'klaipedaPois.json',
    'schools.json',
    'kindergartens.json',
    'sportsClubs.json',
    'childPois.json',
    'klaipedaDistricts.json',
  ];
  return files.flatMap((file) => {
    const payload = readJson(path.join(dir, file), []);
    const items = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : Array.isArray(payload.places) ? payload.places : [];
    return items.map((item) => baseDoc({ ...item, type: item.type || 'poi', source: item.source || 'local_poi' }, 'poi')).filter(Boolean);
  });
}

function loadStops() {
  const file = path.join(ROOT, 'src', 'data', 'gtfs', 'stops.txt');
  if (!fs.existsSync(file)) return [];
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  return rows.map((row) => baseDoc({
    ...row,
    id: `stop-${row.stop_id}`,
    name: row.stop_name,
    address: 'Klaipėdos viešojo transporto stotelė',
    latitude: row.stop_lat,
    longitude: row.stop_lon,
    type: 'stop',
    category: 'station',
    priority: 350,
    source: 'gtfs_stop',
  }, 'stop')).filter(Boolean);
}

function loadAliases(docs) {
  const aliases = readJson(path.join(ROOT, 'src', 'data', 'poi', 'placeAliases.json'), []);
  if (!Array.isArray(aliases)) return docs;
  const byName = new Map(docs.map((doc) => [normalizeText(doc.name), doc]));
  const byId = new Map(docs.map((doc) => [String(doc.id), doc]));
  for (const alias of aliases) {
    const targetKey = normalizeText(alias.target || alias.name || '');
    const doc = byId.get(String(alias.targetId || alias.id || '')) || byName.get(targetKey);
    if (!doc) continue;
    const values = Array.isArray(alias.aliases) ? alias.aliases : [];
    doc.aliases = Array.from(new Set([...(doc.aliases || []), ...values]));
    doc.keywords = doc.aliases;
    doc.searchText = normalizeText([doc.name, doc.address, doc.aliases.join(' ')].join(' '));
    doc.priority = Math.max(Number(doc.priority || 0), Number(alias.priority || 800));
  }
  return docs;
}

async function meili(pathname, options = {}) {
  const response = await fetch(`${MEILI_HOST.replace(/\/$/, '')}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MEILI_MASTER_KEY}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${pathname} failed ${response.status}: ${text}`);
  }
  return response.json().catch(() => ({}));
}

async function main() {
  const docs = loadAliases([...loadAddresses(), ...loadPoi(), ...loadStops()]);
  const unique = Array.from(new Map(docs.map((doc) => [doc.id, doc])).values());

  if (!unique.length) {
    console.warn('[index] no documents found. Add official addresses CSV and POI/GTFS data first.');
  }

  await meili('/indexes', {
    method: 'POST',
    body: JSON.stringify({ uid: INDEX, primaryKey: 'id' }),
  }).catch((error) => {
    if (!String(error.message).includes('index_already_exists')) throw error;
  });

  await meili(`/indexes/${INDEX}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({
      searchableAttributes: ['name', 'title', 'fullAddress', 'address', 'street', 'settlement', 'aliases', 'keywords', 'searchText'],
      displayedAttributes: ['*'],
      filterableAttributes: ['type', 'category', 'municipality', 'settlement', 'source'],
      sortableAttributes: ['priority'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
    }),
  });

  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    await meili(`/indexes/${INDEX}/documents`, {
      method: 'POST',
      body: JSON.stringify(chunk),
    });
    console.log(`[index] uploaded ${Math.min(i + chunk.length, unique.length)}/${unique.length}`);
  }

  console.log(`[index] done. Indexed ${unique.length} documents into ${INDEX}`);
}

main().catch((error) => {
  console.error('[index] failed:', error.message);
  process.exit(1);
});
