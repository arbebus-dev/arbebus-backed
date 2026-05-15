/* eslint-env node */
function addMinutesToGtfsTime(time, minutes) {
  if (!time || !Number.isFinite(Number(minutes))) return time;
  const parts = String(time).split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return time;
  const total = Math.max(0, parts[0] * 60 + parts[1] + Number(minutes));
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function applyRealtimeDelay(step, realtimeByTripId = {}) {
  if (!step || !['bus', 'ride', 'board'].includes(String(step.type))) return step;
  const rt = realtimeByTripId[String(step.tripId || step.routeId || '')];
  const delayMinutes = Math.round(Number(rt?.delaySeconds || step.delaySeconds || 0) / 60);
  if (!delayMinutes) return step;
  return {
    ...step,
    delayMinutes,
    departureTime: addMinutesToGtfsTime(step.departureTime, delayMinutes),
    arrivalTime: addMinutesToGtfsTime(step.arrivalTime, delayMinutes),
  };
}

module.exports = { applyRealtimeDelay, addMinutesToGtfsTime };
