/* eslint-env node */
const https = require('https');
const http = require('http');

function requestBuffer(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'Arbebus/1.0 gtfs-rt', Accept: '*/*' },
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`GTFS-RT HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('GTFS-RT timeout')));
    req.on('error', reject);
  });
}

async function fetchTripUpdatesRaw() {
  const url = process.env.GTFS_RT_TRIP_UPDATES_URL || process.env.KKT_GTFS_RT_TRIP_UPDATES_URL;
  if (!url) {
    return {
      ok: false,
      source: 'gtfs-static-fallback',
      reason: 'GTFS_RT_TRIP_UPDATES_URL missing',
      entities: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    const buffer = await requestBuffer(url, Number(process.env.GTFS_RT_TIMEOUT_MS || 10000));
    return {
      ok: true,
      source: 'gtfs-rt',
      contentType: 'application/x-protobuf',
      byteLength: buffer.length,
      rawBase64: process.env.GTFS_RT_DEBUG_BASE64 === 'true' ? buffer.toString('base64') : undefined,
      entities: [],
      fetchedAt: new Date().toISOString(),
      note: 'Ready for gtfs-realtime-bindings parser when official KKT feed is provided.',
    };
  } catch (error) {
    return {
      ok: false,
      source: 'gtfs-static-fallback',
      reason: error.message,
      entities: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

module.exports = { fetchTripUpdatesRaw };
