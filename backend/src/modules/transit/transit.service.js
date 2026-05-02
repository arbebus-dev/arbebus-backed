const https = require('https');
const http = require('http');

const KLAIPEDA_BOUNDS = {
  minLat: 55.55,
  maxLat: 55.85,
  minLon: 20.95,
  maxLon: 21.35,
};

let liveCache = {
  fetchedAt: 0,
  data: null,
};

function toCoordinate(input, fallback) {
  const latitude = Number(input?.latitude ?? input?.lat ?? fallback?.latitude);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng ?? fallback?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function straightPolyline(from, to) {
  return [from, { latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2 }, to];
}

async function plan(body = {}) {
  const from = toCoordinate(body.origin) || toCoordinate(body.from) || { latitude: 55.7033, longitude: 21.1443 };
  const to = toCoordinate(body.destination) || toCoordinate(body.to) || toCoordinate(body.selectedDestination) || { latitude: 55.68962, longitude: 21.14691 };
  const destinationTitle = body.selectedDestination?.title || body.destination?.title || 'Tikslas';
  const meters = Math.round(distanceMeters(from, to));
  const totalDurationMinutes = Math.max(8, Math.round(meters / 450));
  const walkingMinutes = Math.max(2, Math.round(Math.min(meters, 900) / 80));
  const busMinutes = Math.max(6, totalDurationMinutes - walkingMinutes);
  const routeNumber = meters > 5000 ? '8' : '6';
  const plan = {
    id: `transit-${routeNumber}`,
    title: `Autobusas ${routeNumber}`,
    mode: 'bus',
    routeId: routeNumber,
    routeLabel: routeNumber,
    totalDurationMinutes,
    totalMinutes: totalDurationMinutes,
    totalWalkMinutes: walkingMinutes,
    totalBusMinutes: busMinutes,
    transfersCount: 0,
    stopCount: Math.max(3, Math.round(meters / 650)),
    originStop: { id: 'nearest-stop', name: 'Artimiausia stotelė', title: 'Artimiausia stotelė', ...from, coordinate: from, distanceMeters: 220 },
    destinationStop: { id: 'destination-stop', name: destinationTitle, title: destinationTitle, ...to, coordinate: to, distanceMeters: 180 },
    previewPoints: straightPolyline(from, to),
    polyline: straightPolyline(from, to),
    summary: {
      routeLabel: routeNumber,
      totalDurationMinutes,
      totalWalkMinutes: walkingMinutes,
      totalBusMinutes: busMinutes,
      transfersCount: 0,
      stopCount: Math.max(3, Math.round(meters / 650)),
      boardStopName: 'Artimiausia stotelė',
      alightStopName: destinationTitle,
      etaMinutes: 4,
      journeyMessage: `Važiuok autobusu ${routeNumber} iki „${destinationTitle}“`,
    },
    journeySteps: [
      { id: 'walk-to-stop', type: 'walk', title: 'Eik iki stotelės', durationMinutes: walkingMinutes, minutes: walkingMinutes, distanceMeters: 220 },
      { id: 'board-bus', type: 'board', mode: 'bus', title: `Lipk į autobusą ${routeNumber}`, routeNumber, routeId: routeNumber, stopName: 'Artimiausia stotelė' },
      { id: 'ride-bus', type: 'ride', mode: 'bus', title: `Važiuok autobusu ${routeNumber}`, routeNumber, routeId: routeNumber, stopCount: Math.max(3, Math.round(meters / 650)), durationMinutes: busMinutes, minutes: busMinutes, toStopName: destinationTitle },
      { id: 'alight', type: 'alight', title: 'Išlipk', stopName: destinationTitle },
    ],
  };
  return { ok: true, plan, options: [plan], routes: [plan] };
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Arbebus/1.0 live-buses backend',
        Accept: 'text/plain,*/*',
      },
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`GPS feed returned HTTP ${res.statusCode}`));
        return;
      }
      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error('GPS feed timeout')));
    req.on('error', reject);
  });
}

function normalizeCoordinate(value) {
  const number = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  if (Math.abs(number) > 100000) return number / 1000000;
  return number;
}

function isInKlaipeda(latitude, longitude) {
  return latitude >= KLAIPEDA_BOUNDS.minLat
    && latitude <= KLAIPEDA_BOUNDS.maxLat
    && longitude >= KLAIPEDA_BOUNDS.minLon
    && longitude <= KLAIPEDA_BOUNDS.maxLon;
}

function detectCoordinates(tokens) {
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = normalizeCoordinate(tokens[i]);
    const second = normalizeCoordinate(tokens[i + 1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;

    if (isInKlaipeda(first, second)) {
      return { latitude: first, longitude: second, latIndex: i, lonIndex: i + 1 };
    }

    if (isInKlaipeda(second, first)) {
      return { latitude: second, longitude: first, latIndex: i + 1, lonIndex: i };
    }
  }
  return null;
}

function detectRouteNumber(tokens, latIndex, lonIndex) {
  const candidates = tokens
    .map((token, index) => ({ token: String(token).trim(), index }))
    .filter(({ token, index }) => index !== latIndex && index !== lonIndex && /^[0-9]{1,3}[A-Za-z]?$/.test(token));

  if (candidates.length === 0) return null;
  return candidates[0].token;
}

function detectVehicleId(tokens, fallback) {
  const vehicleLike = tokens.find((token) => /^[A-Za-z0-9_-]{3,}$/.test(String(token).trim()));
  return vehicleLike || fallback;
}

function detectBearing(tokens, latIndex, lonIndex) {
  const nums = tokens
    .map((token, index) => ({ value: Number(String(token).replace(',', '.')), index }))
    .filter(({ value, index }) => Number.isFinite(value) && index !== latIndex && index !== lonIndex);
  const bearing = nums.find(({ value }) => value >= 0 && value <= 360);
  return bearing ? Math.round(bearing.value) : 0;
}

function parseGpsFeed(text) {
  const fetchedAt = new Date().toISOString();
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const buses = [];
  const seen = new Set();

  for (const line of lines) {
    const tokens = line.split(/[;,\t| ]+/).map((token) => token.trim()).filter(Boolean);
    if (tokens.length < 3) continue;

    const coords = detectCoordinates(tokens);
    if (!coords) continue;

    const routeNumber = detectRouteNumber(tokens, coords.latIndex, coords.lonIndex) || 'bus';
    const vehicleId = detectVehicleId(tokens, `${routeNumber}-${coords.latitude.toFixed(5)}-${coords.longitude.toFixed(5)}`);
    const id = `${vehicleId}-${routeNumber}`;
    if (seen.has(id)) continue;
    seen.add(id);

    buses.push({
      id,
      vehicleId: String(vehicleId),
      number: String(routeNumber),
      routeId: String(routeNumber),
      routeNumber: String(routeNumber),
      latitude: coords.latitude,
      longitude: coords.longitude,
      coordinate: { latitude: coords.latitude, longitude: coords.longitude },
      bearing: detectBearing(tokens, coords.latIndex, coords.lonIndex),
      speedKph: null,
      raw: tokens,
      source: 'stops.lt',
      fetchedAt,
    });
  }

  return buses;
}

async function liveBuses() {
  const now = Date.now();
  if (liveCache.data && now - liveCache.fetchedAt < 7000) return liveCache.data;

  const url = process.env.STOPS_LT_GPS_URL || 'https://www.stops.lt/klaipeda/gps_full.txt';
  const text = await requestText(url);
  const buses = parseGpsFeed(text);
  const response = {
    ok: true,
    source: 'stops.lt',
    count: buses.length,
    buses,
    vehicles: buses,
    fetchedAt: new Date().toISOString(),
  };

  liveCache = { fetchedAt: now, data: response };
  return response;
}

async function liveEta(query = {}) {
  const live = await liveBuses();
  const routeId = String(query.routeId || query.routeNumber || '');
  const vehicle = live.buses.find((bus) => !routeId || String(bus.routeId) === routeId) || live.buses[0] || null;
  return {
    ok: true,
    routeId: routeId || vehicle?.routeId || null,
    eta: { etaSeconds: 240, etaMinutes: 4, distanceMeters: 900 },
    boardingState: 'on_the_way',
    vehicle,
  };
}

function shape() {
  const points = [{ latitude: 55.7033, longitude: 21.1443 }, { latitude: 55.696, longitude: 21.146 }, { latitude: 55.68962, longitude: 21.14691 }];
  return { ok: true, points };
}

module.exports = { plan, liveBuses, liveEta, shape, parseGpsFeed };
