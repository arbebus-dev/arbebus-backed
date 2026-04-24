function normalizeRouteId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^0+(?=\d)/, "");
}

function normalizeStopId(value) {
  return String(value || "").trim();
}

function normalizeVehicleId(value) {
  return String(value || "").trim();
}

module.exports = {
  normalizeRouteId,
  normalizeStopId,
  normalizeVehicleId,
};
