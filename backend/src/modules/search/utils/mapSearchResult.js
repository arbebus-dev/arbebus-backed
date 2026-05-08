function numberOrNull(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function hasHouseNumberText(value) {
  return /\b\d+[a-z]?\b/i.test(String(value || ''));
}

function hasStreetToken(value) {
  return /\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(
    String(value || ''),
  );
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

  const combinedText = `${input.title || ''} ${input.subtitle || ''} ${input.address || ''}`;

  if (raw.house_number || hasHouseNumberText(combinedText)) return 'address';

  // Important: road/street without house number must stay a STREET suggestion,
  // not a stop/POI/final address. Route planning happens only after user selects
  // a concrete address/POI/stop.
  if (
    raw.road ||
    raw.street ||
    addressType === 'road' ||
    addressType === 'residential' ||
    osmClass === 'highway' ||
    hasStreetToken(combinedText)
  ) {
    return 'street';
  }

  if (['house', 'postcode', 'amenity'].includes(addressType)) return 'address';

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
    selectable: input.selectable,
    requiresHouseNumber: input.requiresHouseNumber,
  };
}

module.exports = { toResult, numberOrNull, inferType };
