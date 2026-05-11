// Arbebus optimized local address provider
// GPS-aware + coordinate fallback ready

const FALLBACK_KLAIPEDA = {
  lat: 55.7033,
  lon: 21.1443,
};

function normalizeCoordinates(lat, lon) {
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);

  if (
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    parsedLat !== 0 &&
    parsedLon !== 0
  ) {
    return {
      latitude: parsedLat,
      longitude: parsedLon,
    };
  }

  return {
    latitude: FALLBACK_KLAIPEDA.lat,
    longitude: FALLBACK_KLAIPEDA.lon,
  };
}

module.exports = {
  normalizeCoordinates,
  FALLBACK_KLAIPEDA,
};