const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { execFileSync } = require("child_process");

const GTFS_DIR = path.join(__dirname, "..", "data", "gtfs");
const DEFAULT_GTFS_URL =
  process.env.KLAIPEDA_GTFS_URL ||
  "https://www.stops.lt/klaipeda/klaipeda/gtfs.zip";
const USE_REMOTE_GTFS_FIRST = String(process.env.USE_REMOTE_GTFS_FIRST || "") === "1";

let cache = {
  loadedAt: 0,
  data: null,
};

function normalizeId(value) {
  return String(value || "").trim();
}

function normalizeRouteLabel(value, fallback) {
  const trimmed = String(value || "").trim();
  return trimmed || String(fallback || "").trim();
}

function normalizeAgencyName(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((value) => value.trim());
}

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function getLocalFilenames() {
  return [
    "agency.txt",
    "stops.txt",
    "routes.txt",
    "trips.txt",
    "stop_times.txt",
    "calendar.txt",
    "calendar_dates.txt",
    "shapes.txt",
  ];
}

function tryReadLocalGtfsFiles() {
  const filenames = getLocalFilenames();
  const result = {};

  const foundCore =
    fs.existsSync(path.join(GTFS_DIR, "stops.txt")) &&
    fs.existsSync(path.join(GTFS_DIR, "routes.txt")) &&
    fs.existsSync(path.join(GTFS_DIR, "trips.txt")) &&
    fs.existsSync(path.join(GTFS_DIR, "stop_times.txt"));

  if (!foundCore) return null;

  for (const name of filenames) {
    const full = path.join(GTFS_DIR, name);
    if (fs.existsSync(full)) {
      result[name] = fs.readFileSync(full, "utf8");
    }
  }

  return result;
}

async function tryReadRemoteGtfsZip() {
  const tempZip = path.join(os.tmpdir(), `arbebus-gtfs-${Date.now()}.zip`);

  const response = await axios.get(DEFAULT_GTFS_URL, {
    responseType: "arraybuffer",
    timeout: 45000,
    maxContentLength: 150 * 1024 * 1024,
    maxBodyLength: 150 * 1024 * 1024,
    headers: {
      "User-Agent": "Arbebus/1.0",
      Accept: "application/zip, application/octet-stream, */*",
    },
  });

  fs.writeFileSync(tempZip, Buffer.from(response.data));

  try {
    const readFileFromZip = (name) => {
      try {
        return execFileSync("unzip", ["-p", tempZip, name], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          maxBuffer: 1024 * 1024 * 1024,
        });
      } catch (_error) {
        return null;
      }
    };

    const files = {};
    for (const name of getLocalFilenames()) {
      files[name] = readFileFromZip(name);
    }
    return files;
  } finally {
    try {
      fs.unlinkSync(tempZip);
    } catch (_error) {}
  }
}

function getVilniusServiceDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vilnius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    yyyymmdd: `${map.year}${map.month}${map.day}`,
    weekday: String(map.weekday || "").toLowerCase(),
  };
}

function getWeekdayColumn(weekday) {
  switch (weekday) {
    case "monday":
      return "monday";
    case "tuesday":
      return "tuesday";
    case "wednesday":
      return "wednesday";
    case "thursday":
      return "thursday";
    case "friday":
      return "friday";
    case "saturday":
      return "saturday";
    case "sunday":
      return "sunday";
    default:
      return "monday";
  }
}

function buildCalendarIndexes(calendarRows, calendarDatesRows) {
  const calendarByServiceId = new Map();
  const exceptionsByServiceId = new Map();

  for (const row of calendarRows) {
    const serviceId = normalizeId(row.service_id);
    if (!serviceId) continue;

    calendarByServiceId.set(serviceId, {
      serviceId,
      monday: row.monday,
      tuesday: row.tuesday,
      wednesday: row.wednesday,
      thursday: row.thursday,
      friday: row.friday,
      saturday: row.saturday,
      sunday: row.sunday,
      startDate: normalizeId(row.start_date),
      endDate: normalizeId(row.end_date),
    });
  }

  for (const row of calendarDatesRows) {
    const serviceId = normalizeId(row.service_id);
    const date = normalizeId(row.date);
    const exceptionType = normalizeId(row.exception_type);

    if (!serviceId || !date || !exceptionType) continue;

    if (!exceptionsByServiceId.has(serviceId)) {
      exceptionsByServiceId.set(serviceId, new Map());
    }

    exceptionsByServiceId.get(serviceId).set(date, exceptionType);
  }

  return {
    calendarByServiceId,
    exceptionsByServiceId,
  };
}

function isServiceActive(serviceId, calendarIndexes, dateInfo) {
  if (!serviceId) return true;

  const exception = calendarIndexes.exceptionsByServiceId
    .get(serviceId)
    ?.get(dateInfo.yyyymmdd);

  if (exception === "1") return true;
  if (exception === "2") return false;

  const base = calendarIndexes.calendarByServiceId.get(serviceId);
  if (!base) return true;

  if (base.startDate && dateInfo.yyyymmdd < base.startDate) {
    return false;
  }

  if (base.endDate && dateInfo.yyyymmdd > base.endDate) {
    return false;
  }

  const weekdayColumn = getWeekdayColumn(dateInfo.weekday);
  return String(base[weekdayColumn] || "0") === "1";
}

function distanceMetersSimple(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function nearestShapeIndex(shapePoints, stop) {
  if (!Array.isArray(shapePoints) || !shapePoints.length) return -1;

  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let index = 0; index < shapePoints.length; index += 1) {
    const point = shapePoints[index];
    const distance = distanceMetersSimple(point, {
      latitude: stop.latitude,
      longitude: stop.longitude,
    });

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function buildGtfsIndexes(files) {
  const agencyRows = parseCsv(files["agency.txt"] || "");
  const stopsRows = parseCsv(files["stops.txt"] || "");
  const routesRows = parseCsv(files["routes.txt"] || "");
  const tripsRows = parseCsv(files["trips.txt"] || "");
  const stopTimesRows = parseCsv(files["stop_times.txt"] || "");
  const calendarRows = parseCsv(files["calendar.txt"] || "");
  const calendarDatesRows = parseCsv(files["calendar_dates.txt"] || "");
  const shapesRows = parseCsv(files["shapes.txt"] || "");

  const agenciesById = new Map();
  const stopsById = new Map();
  const routesById = new Map();
  const tripsById = new Map();
  const stopTimesByTripId = new Map();
  const shapesById = new Map();

  for (const row of agencyRows) {
    const agencyId = normalizeId(row.agency_id || row.agency_name);
    if (!agencyId) continue;

    agenciesById.set(agencyId, {
      agencyId,
      agencyName: normalizeAgencyName(row.agency_name || row.agency_id),
      agencyUrl: row.agency_url || null,
    });
  }

  for (const row of stopsRows) {
    const stopId = normalizeId(row.stop_id);
    const latitude = Number(row.stop_lat);
    const longitude = Number(row.stop_lon);

    if (!stopId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    stopsById.set(stopId, {
      id: stopId,
      name: row.stop_name || stopId,
      latitude,
      longitude,
      code: row.stop_code || null,
      desc: row.stop_desc || null,
      parentStationId: normalizeId(row.parent_station) || null,
      locationType: row.location_type || null,
    });
  }

  for (const row of routesRows) {
    const routeId = normalizeId(row.route_id);
    if (!routeId) continue;

    const agencyId = normalizeId(row.agency_id);
    const routeTypeNumber = Number(row.route_type);

    routesById.set(routeId, {
      routeId,
      agencyId: agencyId || null,
      agencyName: agenciesById.get(agencyId)?.agencyName || null,
      routeShortName: normalizeRouteLabel(row.route_short_name, routeId),
      routeLongName: row.route_long_name || null,
      routeType: Number.isFinite(routeTypeNumber) ? routeTypeNumber : null,
      routeColor: row.route_color || null,
      routeTextColor: row.route_text_color || null,
      routeDesc: row.route_desc || null,
    });
  }

  for (const row of tripsRows) {
    const tripId = normalizeId(row.trip_id);
    const routeId = normalizeId(row.route_id);

    if (!tripId || !routeId) continue;

    tripsById.set(tripId, {
      tripId,
      routeId,
      serviceId: normalizeId(row.service_id),
      tripHeadsign: row.trip_headsign || null,
      directionId:
        row.direction_id === "0" || row.direction_id === "1"
          ? row.direction_id
          : null,
      shapeId: normalizeId(row.shape_id) || null,
    });
  }

  for (const row of stopTimesRows) {
    const tripId = normalizeId(row.trip_id);
    const stopId = normalizeId(row.stop_id);
    const stopSequence = Number(row.stop_sequence);

    if (!tripId || !stopId || !Number.isFinite(stopSequence)) continue;
    if (!stopsById.has(stopId)) continue;

    if (!stopTimesByTripId.has(tripId)) {
      stopTimesByTripId.set(tripId, []);
    }

    stopTimesByTripId.get(tripId).push({
      stopId,
      stopSequence,
      arrivalTime: row.arrival_time || null,
      departureTime: row.departure_time || null,
    });
  }

  for (const list of stopTimesByTripId.values()) {
    list.sort((a, b) => a.stopSequence - b.stopSequence);
  }

  for (const row of shapesRows) {
    const shapeId = normalizeId(row.shape_id);
    const latitude = Number(row.shape_pt_lat);
    const longitude = Number(row.shape_pt_lon);
    const sequence = Number(row.shape_pt_sequence);

    if (
      !shapeId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(sequence)
    ) {
      continue;
    }

    if (!shapesById.has(shapeId)) {
      shapesById.set(shapeId, []);
    }

    shapesById.get(shapeId).push({
      latitude,
      longitude,
      sequence,
    });
  }

  for (const list of shapesById.values()) {
    list.sort((a, b) => a.sequence - b.sequence);
  }

  const calendarIndexes = buildCalendarIndexes(calendarRows, calendarDatesRows);
  const variantBuckets = new Map();

  for (const trip of tripsById.values()) {
    const stopTimes = stopTimesByTripId.get(trip.tripId);
    if (!stopTimes || stopTimes.length < 2) continue;

    const stopIds = stopTimes.map((item) => item.stopId);
    const signature = stopIds.join(">");
    const route = routesById.get(trip.routeId);

    const bucketKey = [
      trip.routeId,
      trip.directionId ?? "X",
      trip.tripHeadsign || "",
      signature,
    ].join("|");

    if (!variantBuckets.has(bucketKey)) {
      variantBuckets.set(bucketKey, {
        routeId: trip.routeId,
        routeLabel: route?.routeShortName || trip.routeId,
        routeLongName: route?.routeLongName || null,
        routeType: route?.routeType ?? null,
        agencyName: route?.agencyName || null,
        directionId: trip.directionId,
        directionCode:
          trip.directionId === "0"
            ? "A"
            : trip.directionId === "1"
            ? "B"
            : null,
        headsign: trip.tripHeadsign || null,
        stopIds,
        tripIds: [],
        serviceIds: new Set(),
        shapeIds: new Map(),
        frequency: 0,
      });
    }

    const bucket = variantBuckets.get(bucketKey);
    bucket.frequency += 1;
    bucket.tripIds.push(trip.tripId);

    if (trip.serviceId) {
      bucket.serviceIds.add(trip.serviceId);
    }

    if (trip.shapeId) {
      bucket.shapeIds.set(
        trip.shapeId,
        (bucket.shapeIds.get(trip.shapeId) || 0) + 1
      );
    }
  }

  const variants = Array.from(variantBuckets.values())
    .map((variant, index) => {
      const stopIndexByStopId = new Map();
      variant.stopIds.forEach((stopId, stopIndex) => {
        stopIndexByStopId.set(stopId, stopIndex);
      });

      let primaryShapeId = null;
      let shapeVotes = -1;

      for (const [shapeId, count] of variant.shapeIds.entries()) {
        if (count > shapeVotes) {
          primaryShapeId = shapeId;
          shapeVotes = count;
        }
      }

      const shapePoints = primaryShapeId
        ? (shapesById.get(primaryShapeId) || []).map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          }))
        : [];

      return {
        id: `variant-${index + 1}`,
        routeId: variant.routeId,
        routeLabel: variant.routeLabel,
        routeLongName: variant.routeLongName,
        routeType: variant.routeType,
        agencyName: variant.agencyName,
        directionId: variant.directionId,
        directionCode: variant.directionCode,
        headsign: variant.headsign,
        frequency: variant.frequency,
        stopIds: variant.stopIds,
        stopIndexByStopId,
        tripIds: variant.tripIds,
        serviceIds: Array.from(variant.serviceIds),
        primaryShapeId,
        shapePoints,
      };
    })
    .sort((a, b) => {
      if (a.routeLabel === b.routeLabel) {
        return b.frequency - a.frequency;
      }
      return a.routeLabel.localeCompare(b.routeLabel);
    });

  const variantsByRouteId = new Map();
  const variantsByStopId = new Map();

  for (const variant of variants) {
    if (!variantsByRouteId.has(variant.routeId)) {
      variantsByRouteId.set(variant.routeId, []);
    }
    variantsByRouteId.get(variant.routeId).push(variant);

    for (const stopId of variant.stopIds) {
      if (!variantsByStopId.has(stopId)) {
        variantsByStopId.set(stopId, []);
      }
      variantsByStopId.get(stopId).push(variant);
    }
  }

  const dateInfo = getVilniusServiceDate();
  const activeServiceIds = new Set();

  const allServiceIds = new Set([
    ...Array.from(calendarIndexes.calendarByServiceId.keys()),
    ...Array.from(calendarIndexes.exceptionsByServiceId.keys()),
  ]);

  for (const serviceId of allServiceIds) {
    if (isServiceActive(serviceId, calendarIndexes, dateInfo)) {
      activeServiceIds.add(serviceId);
    }
  }

  const activeVariants = variants.filter((variant) => {
    if (!variant.serviceIds.length) return true;
    return variant.serviceIds.some((serviceId) => activeServiceIds.has(serviceId));
  });

  const activeVariantsByStopId = new Map();
  const activeVariantsByRouteId = new Map();

  for (const variant of activeVariants) {
    if (!activeVariantsByRouteId.has(variant.routeId)) {
      activeVariantsByRouteId.set(variant.routeId, []);
    }
    activeVariantsByRouteId.get(variant.routeId).push(variant);

    for (const stopId of variant.stopIds) {
      if (!activeVariantsByStopId.has(stopId)) {
        activeVariantsByStopId.set(stopId, []);
      }
      activeVariantsByStopId.get(stopId).push(variant);
    }
  }

  const routeTypeCounts = {};
  for (const route of routesById.values()) {
    const key = String(route.routeType ?? "unknown");
    routeTypeCounts[key] = (routeTypeCounts[key] || 0) + 1;
  }

  return {
    meta: {
      stopsCount: stopsById.size,
      routesCount: routesById.size,
      tripsCount: tripsById.size,
      variantsCount: variants.length,
      activeVariantsCount: activeVariants.length,
      activeServiceIdsCount: activeServiceIds.size,
      shapesCount: shapesById.size,
      agenciesCount: agenciesById.size,
      serviceDate: dateInfo.yyyymmdd,
      weekday: dateInfo.weekday,
      loadedAtIso: new Date().toISOString(),
      source: files.source || "unknown",
      routeTypeCounts,
    },
    agenciesById,
    stopsById,
    routesById,
    tripsById,
    stopTimesByTripId,
    shapesById,
    variants,
    activeVariants,
    variantsByRouteId,
    variantsByStopId,
    activeVariantsByRouteId,
    activeVariantsByStopId,
    nearestShapeIndex,
  };
}

async function loadGtfsData({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.data && now - cache.loadedAt < 10 * 60 * 1000) {
    return cache.data;
  }

  let files = null;

  if (USE_REMOTE_GTFS_FIRST) {
    try {
      files = await tryReadRemoteGtfsZip();
      files.source = "remote_gtfs_zip";
    } catch (_error) {
      files = tryReadLocalGtfsFiles();
      if (files) files.source = "local_gtfs_dir";
    }
  } else {
    files = tryReadLocalGtfsFiles();
    if (files) {
      files.source = "local_gtfs_dir";
    } else {
      files = await tryReadRemoteGtfsZip();
      files.source = "remote_gtfs_zip";
    }
  }

  const data = buildGtfsIndexes(files);

  cache = {
    loadedAt: now,
    data,
  };

  return data;
}

module.exports = {
  loadGtfsData,
};
