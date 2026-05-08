function numberOrNull(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function inferType(input) {
  const rawType = String(input.type || '').toLowerCase();
  const category = String(input.category || '').toLowerCase();
  const raw = input.raw || {};
  const addressType = String(raw.addresstype || raw.type || '').toLowerCase();
  const osmClass = String(raw.class || raw.category || '').toLowerCase();

  if (['stop', 'station', 'ferry', 'address', 'street', 'city', 'region', 'poi'].includes(rawType)) return rawType;

  if (['city', 'town', 'village', 'hamlet', 'municipality', 'county'].includes(addressType)) return addressType === 'village' ? 'city' : addressType;
  if (['administrative', 'boundary'].includes(category) || ['boundary', 'place'].includes(osmClass)) {
    if (['village', 'town', 'city', 'municipality', 'county'].includes(addressType)) return addressType === 'village' ? 'city' : addressType;
    return 'region';
  }
  if (['house', 'road', 'residential', 'postcode', 'amenity'].includes(addressType) && raw.house_number) return 'address';
  if (raw.house_number || raw.road || raw.street || /\b\d+[a-z]?\b/i.test(String(input.subtitle || input.title || ''))) return 'address';
  return rawType || 'poi';
}

function toResult(input) {
  if (!input) return null;
  const latitude = numberOrNull(input.latitude ?? input.lat);
  const longitude = numberOrNull(input.longitude ?? input.lon ?? input.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const title = String(input.title ?? input.name ?? input.display_name ?? '').trim();
  if (!title) return null;

  const type = inferType(input);
  return {
    id: String(input.id || `${type}-${title}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`),
    type,
    title,
    name: String(input.name || title),
    subtitle: String(input.subtitle || input.address || input.description || input.label || ''),
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: String(input.source || 'unknown'),
    category: input.category || null,
    score: Number(input.score || 0),
    priority: Number(input.priority || 0),
    keywords: Array.isArray(input.keywords) ? input.keywords : [],
    raw: input.raw,
  };
}

module.exports = { toResult, numberOrNull, inferType };
