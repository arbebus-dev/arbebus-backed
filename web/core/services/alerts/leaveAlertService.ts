export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type LeaveAlertPlanInput = {
  userCoordinate: Coordinate;
  pickupCoordinate: Coordinate;
  routeEtaSeconds: number;
  prepMinutes?: number;
  minLeadSeconds?: number;
};

export type LeaveAlertPlan = {
  walkDistanceMeters: number;
  walkSeconds: number;
  prepSeconds: number;
  busArrivalAt: Date;
  triggerAt: Date;
  notifyInSeconds: number;
  shouldLeaveNow: boolean;
};

const WALKING_SPEED_MPS = 1.35;
const DEFAULT_PREP_MINUTES = 2;
const DEFAULT_MIN_LEAD_SECONDS = 45;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(a: Coordinate, b: Coordinate) {
  const earthRadius = 6371000;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const arc = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  return earthRadius * arc;
}

export function estimateWalkSeconds(
  userCoordinate: Coordinate,
  pickupCoordinate: Coordinate
) {
  const distanceMeters = getDistanceMeters(userCoordinate, pickupCoordinate);

  const baseSeconds = distanceMeters / WALKING_SPEED_MPS;
  const safetyBufferSeconds = 60;

  return {
    walkDistanceMeters: Math.round(distanceMeters),
    walkSeconds: Math.max(60, Math.round(baseSeconds + safetyBufferSeconds)),
  };
}

export function buildLeaveAlertPlan(
  input: LeaveAlertPlanInput
): LeaveAlertPlan {
  const prepSeconds = Math.max(
    0,
    Math.round((input.prepMinutes ?? DEFAULT_PREP_MINUTES) * 60)
  );
  const minLeadSeconds = Math.max(
    0,
    Math.round(input.minLeadSeconds ?? DEFAULT_MIN_LEAD_SECONDS)
  );

  const { walkDistanceMeters, walkSeconds } = estimateWalkSeconds(
    input.userCoordinate,
    input.pickupCoordinate
  );

  const routeEtaSeconds = Math.max(60, Math.round(input.routeEtaSeconds));
  const now = Date.now();
  const busArrivalAt = new Date(now + routeEtaSeconds * 1000);

  const totalNeededSeconds = walkSeconds + prepSeconds;
  const rawTriggerMs = busArrivalAt.getTime() - totalNeededSeconds * 1000;
  const earliestAllowedTriggerMs = now + minLeadSeconds * 1000;
  const triggerMs = Math.max(rawTriggerMs, earliestAllowedTriggerMs);
  const notifyInSeconds = Math.max(1, Math.round((triggerMs - now) / 1000));

  return {
    walkDistanceMeters,
    walkSeconds,
    prepSeconds,
    busArrivalAt,
    triggerAt: new Date(triggerMs),
    notifyInSeconds,
    shouldLeaveNow: rawTriggerMs <= now,
  };
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;

  if (minutes <= 0) return `${remaining}s`;
  if (remaining === 0) return `${minutes} min`;
  return `${minutes} min ${remaining}s`;
}

export function formatClock(date: Date) {
  return date.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}