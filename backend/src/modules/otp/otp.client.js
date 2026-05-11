/* eslint-env node */
const OTP_BASE_URL = process.env.OTP_BASE_URL || process.env.OTP_URL || 'http://127.0.0.1:8080';

function enabled() {
  return ['otp', 'otp2'].includes(String(process.env.TRANSIT_ENGINE || '').toLowerCase()) || Boolean(process.env.OTP_BASE_URL || process.env.OTP_URL);
}

function graphqlUrl() {
  return `${String(OTP_BASE_URL).replace(/\/$/, '')}/otp/routers/default/index/graphql`;
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function coordinate(value, name) {
  const lat = toNumber(value?.latitude ?? value?.lat);
  const lon = toNumber(value?.longitude ?? value?.lng ?? value?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`${name} coordinate is invalid`);
  }
  return { lat, lon };
}

async function plan({ from, to, date, time, arriveBy = false, timeoutMs = 9000 } = {}) {
  if (!enabled()) return { ok: false, skipped: true, reason: 'OTP_DISABLED' };

  const origin = coordinate(from, 'from');
  const destination = coordinate(to, 'to');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const query = `
    query Plan($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!, $date: String, $time: String, $arriveBy: Boolean) {
      plan(
        from: { lat: $fromLat, lon: $fromLon }
        to: { lat: $toLat, lon: $toLon }
        date: $date
        time: $time
        arriveBy: $arriveBy
        transportModes: [{ mode: WALK }, { mode: TRANSIT }]
      ) {
        itineraries {
          duration
          startTime
          endTime
          walkDistance
          transfers
          legs {
            mode
            startTime
            endTime
            distance
            duration
            legGeometry { points }
            from { name lat lon stop { gtfsId code } }
            to { name lat lon stop { gtfsId code } }
            route { gtfsId shortName longName color textColor }
            trip { gtfsId tripHeadsign }
            intermediateStops { name lat lon stop { gtfsId code } }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(graphqlUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          fromLat: origin.lat,
          fromLon: origin.lon,
          toLat: destination.lat,
          toLon: destination.lon,
          date: date || null,
          time: time || null,
          arriveBy: Boolean(arriveBy),
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.errors?.length) {
      return { ok: false, error: payload.errors?.[0]?.message || `OTP_HTTP_${response.status}`, raw: payload };
    }

    return { ok: true, raw: payload, itineraries: payload?.data?.plan?.itineraries || [] };
  } catch (error) {
    return { ok: false, error: error.name === 'AbortError' ? 'OTP_TIMEOUT' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { enabled, plan, OTP_BASE_URL };
