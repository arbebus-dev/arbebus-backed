/* eslint-env node */
const { normalizeText } = require('../utils/normalizeText');

const DEFAULT_INDEX = process.env.MEILI_INDEX || 'places';
const DEFAULT_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const DEFAULT_KEY = process.env.MEILI_MASTER_KEY || process.env.MEILI_API_KEY || '';

function enabled() {
  const engine = String(process.env.SEARCH_ENGINE || '').toLowerCase();
  const flag = String(process.env.SEARCH_PROVIDER_MEILI_ENABLED || '').toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  if (flag === 'true' || flag === '1') return true;
  return engine === 'meili' || engine === 'meilisearch' || Boolean(process.env.MEILI_HOST);
}

function authHeaders() {
  return DEFAULT_KEY ? { Authorization: `Bearer ${DEFAULT_KEY}` } : {};
}

function endpoint(path) {
  return `${String(DEFAULT_HOST).replace(/\/$/, '')}${path}`;
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toResult(item = {}, query = '') {
  const latitude = toNumber(item.latitude ?? item.lat);
  const longitude = toNumber(item.longitude ?? item.lng ?? item.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const type = String(item.type || item.category || 'place').toLowerCase();
  const title = String(item.title || item.name || item.full_address || item.fullAddress || item.address || '').trim();
  if (!title) return null;

  const subtitle = String(
    item.subtitle || item.full_address || item.fullAddress || item.address || item.municipality || ''
  ).trim();

  const basePriority = Number(item.priority ?? (type === 'address' ? 950 : type === 'stop' ? 350 : 650));
  const exactBoost = normalizeText(title) === normalizeText(query) ? 600 : 0;

  return {
    id: String(item.id || `meili-${type}-${latitude}-${longitude}`),
    type,
    title,
    name: title,
    subtitle,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: item.source || 'meilisearch',
    category: item.category || type,
    score: Number(item.score || 0) + basePriority + exactBoost,
    priority: basePriority,
    keywords: Array.isArray(item.aliases) ? item.aliases : Array.isArray(item.keywords) ? item.keywords : [],
    selectable: item.selectable !== false,
    requiresHouseNumber: Boolean(item.requiresHouseNumber),
    raw: item,
  };
}

async function searchMeili(query, options = {}) {
  const q = String(query || '').trim();
  if (!enabled() || q.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 10), 1), 30);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || process.env.MEILI_TIMEOUT_MS || 1200));

  try {
    const response = await fetch(endpoint(`/indexes/${encodeURIComponent(DEFAULT_INDEX)}/search`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        q,
        limit,
        attributesToCrop: [],
        attributesToHighlight: [],
        showMatchesPosition: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.hits || []).map((item) => toResult(item, q)).filter(Boolean);
  } catch (_error) {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function health() {
  if (!enabled()) return { meili: { enabled: false, ok: false } };
  try {
    const response = await fetch(endpoint('/health'), { headers: authHeaders() });
    const payload = await response.json().catch(() => ({}));
    return { meili: { enabled: true, ok: response.ok, status: payload.status || null, host: DEFAULT_HOST, index: DEFAULT_INDEX } };
  } catch (error) {
    return { meili: { enabled: true, ok: false, error: error.message, host: DEFAULT_HOST, index: DEFAULT_INDEX } };
  }
}

module.exports = { searchMeili, meiliHealth: health };
