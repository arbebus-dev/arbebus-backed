const path = require('path');
const fs = require('fs');
const { normalizeText } = require('../utils/normalizeText');
const { toResult, numberOrNull } = require('../utils/mapSearchResult');

const DATA_ROOT = path.join(__dirname, '../../../data');
const GTFS_ROOT = path.join(DATA_ROOT, 'gtfs');
let cache = null;

function readFile(file) {
  try {
    const p = path.join(GTFS_ROOT, file);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  } catch { return ''; }
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    const n = line[i + 1];
    if (c === '"' && quoted && n === '"') { current += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { out.push(current); current = ''; }
    else current += c;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function parseCsv(text) {
  const rows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rows.length < 2) return [];
  const headers = parseCsvLine(rows[0]);
  return rows.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((obj, h, i) => { obj[h] = values[i] ?? ''; return obj; }, {});
  });
}

function readJsonSafe(file, fallback = []) {
  try {
    const p = path.join(DATA_ROOT, file);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function loadGtfsStops() {
  if (cache) return cache;
  const stopsRaw = parseCsv(readFile('stops.txt'));
  const seedRaw = readJsonSafe('gtfs/klaipedaSeedStops.json', []);
  const raw = stopsRaw.length ? stopsRaw : seedRaw;
  cache = raw.map((stop) => {
    const lat = numberOrNull(stop.stop_lat ?? stop.latitude ?? stop.lat);
    const lon = numberOrNull(stop.stop_lon ?? stop.longitude ?? stop.lon ?? stop.lng);
    const name = String(stop.stop_name || stop.name || '').trim();
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return toResult({
      id: `stop-${stop.stop_id || stop.stop_code || normalizeText(name).replace(/\s+/g, '-')}`,
      type: 'stop',
      title: name,
      subtitle: 'Viešojo transporto stotelė',
      latitude: lat,
      longitude: lon,
      source: stopsRaw.length ? 'gtfs' : 'seed',
      keywords: [stop.stop_code, stop.stop_desc, name.replace(/\s+st\.?$/i, '')].filter(Boolean),
      stopId: stop.stop_id,
      stopCode: stop.stop_code,
    });
  }).filter(Boolean);
  return cache;
}

async function searchGtfsStops(query, options = {}) {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];
  const parts = q.split(' ').filter(Boolean);
  const limit = Number(options.limit || 10);
  return loadGtfsStops()
    .map((item) => {
      const fields = [item.title, item.subtitle, ...(item.keywords || [])].map(normalizeText);
      let score = 0;
      for (const f of fields) {
        if (f === q) score = Math.max(score, 120);
        else if (f.startsWith(q)) score = Math.max(score, 95);
        else if (f.includes(q)) score = Math.max(score, 70);
        else if (parts.every((p) => f.includes(p))) score = Math.max(score, 50);
      }
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function gtfsHealth() {
  const items = loadGtfsStops();
  return { gtfsStopsCount: items.filter((i) => i.source === 'gtfs').length, seedStopsCount: items.filter((i) => i.source === 'seed').length };
}

module.exports = { searchGtfsStops, loadGtfsStops, gtfsHealth };
