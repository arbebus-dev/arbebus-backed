/* eslint-env node */
const https = require('https');
const routing = require('./routing.service');

const ORS_BASE_URL = process.env.ORS_BASE_URL || 'https://api.openrouteservice.org';
const DEFAULT_TIMEOUT_MS = Number(process.env.ORS_TIMEOUT_MS || 9000);

function toCoordinate(input, fallback) {
  const latitude = Number(input?.latitude ?? input?.lat ?? input?.coordinate?.latitude ?? fallback?.latitude);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng ?? input?.coordinate?.longitude ?? fallback?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  return routing.distanceMeters(a, b);
}

function fallbackWalking(from, to, reason = 'ORS unavailable') {
  const distance = Math.round(distanceMeters(from, to));
  const durationMinutes = Math.max(1, Math.round(distance / 78));
  const polyline = routing.buildLine(from, to);

  return {
    ok: true,
    provider: 'fallback',
    mode: 'walking',
    reason,
    distanceMeters: distance,
    durationSeconds: durationMinutes * 60,
    durationMinutes,
    polyline,
    points: polyline,
    coordinates: polyline,
  };
}

function parseORSFeature(feature) {
  const coordinates = feature?.geometry?.coordinates || [];
  const summary = feature?.properties?.summary || {};
  const segments = feature?.properties?.segments || [];
  const firstSegment = segments[0] || {};

  const polyline = coordinates
    .map((point) => {
      const longitude = Number(point?.[0]);
      const latitude = Number(point?.[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    })
    .filter(Boolean);

  const distanceMetersValue = Number(summary.distance ?? firstSegment.distance ?? 0);
  const durationSeconds = Number(summary.duration ?? firstSegment.duration ?? 0);

  return {
    ok: true,
    provider: 'ors',
    mode: 'walking',
    distanceMeters: Number.isFinite(distanceMetersValue) ? Math.round(distanceMetersValue) : null,
    durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
    durationMinutes: Number.isFinite(durationSeconds) ? Math.max(1, Math.round(durationSeconds / 60)) : null,
    polyline,
    points: polyline,
    coordinates: polyline,
    steps: firstSegment.steps || [],
  };
}

function postJson(url, payload, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      url,
      {
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, application/geo+json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`ORS HTTP ${res.statusCode}: ${data.slice(0, 240)}`));
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error('ORS timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function walkingDirections(payload = {}) {
  const from = toCoordinate(payload.origin || payload.from, { latitude: 55.7033, longitude: 21.1443 });
  const to = toCoordinate(payload.destination || payload.to, { latitude: 55.68962, longitude: 21.14691 });

  if (!from || !to) {
    return fallbackWalking(
      from || { latitude: 55.7033, longitude: 21.1443 },
      to || { latitude: 55.68962, longitude: 21.14691 },
      'Invalid coordinates',
    );
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey || apiKey === 'test' || apiKey === 'xxx') {
    return fallbackWalking(from, to, 'ORS_API_KEY missing');
  }

  try {
    const url = `${ORS_BASE_URL.replace(/\/$/, '')}/v2/directions/foot-walking/geojson`;
    const response = await postJson(
      url,
      {
        coordinates: [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ],
        instructions: true,
        preference: 'recommended',
        units: 'm',
      },
      { Authorization: apiKey },
      Number(payload.timeoutMs || DEFAULT_TIMEOUT_MS),
    );

    const parsed = parseORSFeature(response?.features?.[0]);
    if (!parsed.polyline?.length) return fallbackWalking(from, to, 'ORS returned empty geometry');
    return parsed;
  } catch (error) {
    return fallbackWalking(from, to, error.message || 'ORS failed');
  }
}

async function directions(payload = {}) {
  if ((payload.mode || 'walking') === 'walking') return walkingDirections(payload);
  return routing.directions(payload);
}

module.exports = {
  directions,
  walkingDirections,
  fallbackWalking,
};
