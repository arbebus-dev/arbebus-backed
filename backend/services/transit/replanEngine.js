const { pickBestVehicleForStop } = require("./etaEstimator");

function buildLeaveTrigger({ etaSeconds, walkSeconds, prepSeconds }) {
  const now = Date.now();
  const arrivalAtMs = now + etaSeconds * 1000;
  const triggerAtMs = Math.max(
    now + 45 * 1000,
    arrivalAtMs - (walkSeconds + prepSeconds) * 1000
  );

  return {
    arrivalAtIso: new Date(arrivalAtMs).toISOString(),
    triggerAtIso: new Date(triggerAtMs).toISOString(),
  };
}

function computeReplanDeltaSeconds(oldIso, nextIso) {
  const oldMs = new Date(oldIso).getTime();
  const nextMs = new Date(nextIso).getTime();

  if (!Number.isFinite(oldMs) || !Number.isFinite(nextMs)) return 999999;
  return Math.abs(Math.round((nextMs - oldMs) / 1000));
}

function replanAlert({ alert, vehicles, matchedStop }) {
  const best = pickBestVehicleForStop({
    vehicles,
    routeId: alert.routeId,
    stop: matchedStop,
  });

  if (!best) {
    return {
      changed: false,
      reason: "no_vehicle_match",
      nextAlert: alert,
    };
  }

  const nextTimes = buildLeaveTrigger({
    etaSeconds: best.etaSeconds,
    walkSeconds: alert.walkSeconds,
    prepSeconds: alert.prepSeconds,
  });

  const deltaSeconds = computeReplanDeltaSeconds(
    alert.triggerAtIso,
    nextTimes.triggerAtIso
  );

  if (deltaSeconds < 90) {
    return {
      changed: false,
      reason: "change_too_small",
      nextAlert: {
        ...alert,
        selectedBusId: best.vehicle.vehicleId,
        arrivalAtIso: nextTimes.arrivalAtIso,
      },
    };
  }

  return {
    changed: true,
    reason: "significant_replan",
    nextAlert: {
      ...alert,
      selectedBusId: best.vehicle.vehicleId,
      arrivalAtIso: nextTimes.arrivalAtIso,
      triggerAtIso: nextTimes.triggerAtIso,
      lastReplannedAtIso: new Date().toISOString(),
    },
    deltaSeconds,
    bestVehicle: best.vehicle,
  };
}

module.exports = {
  replanAlert,
};