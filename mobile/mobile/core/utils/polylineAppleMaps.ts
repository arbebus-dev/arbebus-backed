export type LatLngPoint = {
  latitude: number;
  longitude: number;
};

function isFinitePoint(point: any): point is LatLngPoint {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude)) &&
    Math.abs(Number(point.latitude)) <= 90 &&
    Math.abs(Number(point.longitude)) <= 180
  );
}

export function cleanPolyline(input?: any): LatLngPoint[] {
  if (!Array.isArray(input)) return [];

  const result: LatLngPoint[] = [];

  for (const raw of input) {
    const point = Array.isArray(raw)
      ? { latitude: Number(raw[1]), longitude: Number(raw[0]) }
      : { latitude: Number(raw?.latitude), longitude: Number(raw?.longitude) };

    if (!isFinitePoint(point)) continue;

    const previous = result[result.length - 1];
    if (
      previous &&
      Math.abs(previous.latitude - point.latitude) < 0.000001 &&
      Math.abs(previous.longitude - point.longitude) < 0.000001
    ) {
      continue;
    }

    result.push(point);
  }

  return result;
}

export function smoothPolyline(coords?: LatLngPoint[]): LatLngPoint[] {
  const clean = cleanPolyline(coords);
  if (clean.length < 3) return clean;

  // Light smoothing only. Too much smoothing makes street-following shapes look fake.
  const output: LatLngPoint[] = [clean[0]];

  for (let i = 1; i < clean.length - 1; i += 1) {
    const prev = clean[i - 1];
    const current = clean[i];
    const next = clean[i + 1];

    output.push({
      latitude: prev.latitude * 0.12 + current.latitude * 0.76 + next.latitude * 0.12,
      longitude: prev.longitude * 0.12 + current.longitude * 0.76 + next.longitude * 0.12,
    });
  }

  output.push(clean[clean.length - 1]);
  return output;
}

export function polylineLengthMeters(coords?: LatLngPoint[]): number {
  const clean = cleanPolyline(coords);
  if (clean.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < clean.length; i += 1) {
    total += distanceMeters(clean[i - 1], clean[i]);
  }

  return total;
}

function distanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
