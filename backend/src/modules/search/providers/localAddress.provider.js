const { normalizeText } = require('../utils/normalizeText');
const { toResult } = require('../utils/mapSearchResult');

const STREETS = [
  { names: ['taikos pr', 'taikos prospektas', 'taikos'], title: 'Taikos pr.', lat: 55.6909, lon: 21.1567 },
  { names: ['herkaus manto g', 'h manto g', 'h manto', 'manto g', 'herkaus manto'], title: 'H. Manto g.', lat: 55.7212, lon: 21.1289 },
  { names: ['liepu g', 'liepu', 'liepų g', 'liepų'], title: 'Liepų g.', lat: 55.7114, lon: 21.1371 },
  { names: ['tilzes g', 'tilzes', 'tilžės g', 'tilžės'], title: 'Tilžės g.', lat: 55.6981, lon: 21.1617 },
  { names: ['minijos g', 'minijos'], title: 'Minijos g.', lat: 55.6819, lon: 21.1513 },
  { names: ['silutes pl', 'silutes plentas', 'šilutės pl', 'šilutės plentas'], title: 'Šilutės pl.', lat: 55.6751, lon: 21.1766 },
  { names: ['baltijos pr', 'baltijos prospektas', 'baltijos'], title: 'Baltijos pr.', lat: 55.6815, lon: 21.1644 },
  { names: ['smilteles g', 'smilteles', 'smiltelės g', 'smiltelės'], title: 'Smiltelės g.', lat: 55.6584, lon: 21.1794 },
  { names: ['statybininku pr', 'statybininku prospektas', 'statybininkų pr'], title: 'Statybininkų pr.', lat: 55.6658, lon: 21.1785 },
  { names: ['debre ceno g', 'debre ceno', 'debreceno g', 'debreceno'], title: 'Debreceno g.', lat: 55.6727, lon: 21.1805 },
  { names: ['mokyklos g', 'mokyklos'], title: 'Mokyklos g.', lat: 55.7019, lon: 21.1605 },
  { names: ['kretingos g', 'kretingos'], title: 'Kretingos g.', lat: 55.7345, lon: 21.1304 },
  { names: ['priestocio g', 'priestocio', 'priešstočio g', 'priešstočio'], title: 'Priestočio g.', lat: 55.7173, lon: 21.1398 },
  { names: ['naujojo sodo g', 'naujojo sodo'], title: 'Naujojo Sodo g.', lat: 55.7106, lon: 21.1341 },
  { names: ['jurininku pr', 'jūrininkų pr', 'jurininku', 'jūrininkų'], title: 'Jūrininkų pr.', lat: 55.6547, lon: 21.1819 },
  { names: ['mogiliovo g', 'mogiliovo'], title: 'Mogiliovo g.', lat: 55.6578, lon: 21.1905 },
  { names: ['vingio g', 'vingio'], title: 'Vingio g.', lat: 55.6559, lon: 21.1772 },
  { names: ['laukininku g', 'laukininkų g', 'laukininku', 'laukininkų'], title: 'Laukininkų g.', lat: 55.6546, lon: 21.1878 },
  { names: ['reikjaviko g', 'reikjaviko'], title: 'Reikjaviko g.', lat: 55.6526, lon: 21.1818 },
  { names: ['savanoriu pr', 'savanorių pr', 'savanoriu', 'savanorių'], title: 'Savanorių pr.', lat: 55.7299, lon: 21.1285 },
];

function extractHouseNumber(query) {
  const match = String(query || '').match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function offsetCoordinate(street, houseNumber) {
  const number = Number(String(houseNumber || '').replace(/[^0-9]/g, ''));
  if (!Number.isFinite(number) || number <= 0) {
    return { latitude: street.lat, longitude: street.lon };
  }

  // Small deterministic offset along the street so different house numbers do not
  // collapse into the exact same point. This is only a local fallback until a paid
  // geocoder is connected.
  const offset = Math.min(Math.max(number, 1), 220) * 0.000018;
  return {
    latitude: street.lat + offset * 0.35,
    longitude: street.lon + offset,
  };
}

function matchesStreet(query, street) {
  const q = normalizeText(query).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  return street.names.some((name) => {
    const n = normalizeText(name).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    return q.includes(n) || n.includes(q);
  });
}

function searchLocalAddresses(query, options = {}) {
  const q = String(query || '').trim();
  const nq = normalizeText(q).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (nq.length < 3) return [];

  const house = extractHouseNumber(q);
  const limit = Math.min(Math.max(Number(options.limit || 6), 1), 10);
  const results = [];

  for (const street of STREETS) {
    if (!matchesStreet(q, street)) continue;
    const coordinate = offsetCoordinate(street, house);
    const exactTitle = house ? `${street.title} ${house}` : street.title;

    results.push(toResult({
      id: `local-address-${normalizeText(exactTitle).replace(/\s+/g, '-')}`,
      type: house ? 'address' : 'street',
      title: exactTitle,
      subtitle: 'Klaipėda, Lietuva',
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      source: 'local_address',
      category: house ? 'Adresas' : 'Gatvė',
      priority: house ? 120 : 95,
      score: house ? 360 : 260,
      keywords: [street.title, ...street.names, 'Klaipėda', 'adresas', 'gatvė'],
    }));
  }

  return results.slice(0, limit);
}

function localAddressHealth() {
  return { localAddressItems: STREETS.length };
}

module.exports = { searchLocalAddresses, localAddressHealth };
