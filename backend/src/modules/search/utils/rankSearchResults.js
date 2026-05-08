const { normalizeText } = require("./normalizeText");

const TYPE_WEIGHT = {
  school: 112,
  kindergarten: 108,
  sports_club: 104,
  district: 98,
  saved_place_template: 72,
  poi: 92,
  address: 86,
  street: 84,
  city: 82,
  region: 78,
  village: 78,
  station: 72,
  ferry: 72,
  stop: 40,
};

const SOURCE_WEIGHT = {
  local_poi: 120,
  local_address: 118,
  google_places: 110,
  nominatim: 92,
  overpass: 82,
  ors: 76,
  gtfs: 36,
  seed: 20,
};

function hasHouseNumber(query) {
  return /\b\d+[a-z]?\b/i.test(String(query || ""));
}

function looksLikeStopQuery(query) {
  const q = normalizeText(query);
  return /\b(st|stotele|stotel|stotis|autobus|bus|perone|st\.)\b/.test(q);
}

function textScore(item, query) {
  const q = normalizeText(query);
  const parts = q.split(" ").filter(Boolean);
  const fields = [
    item.title,
    item.name,
    item.subtitle,
    item.category,
    ...(item.keywords || []),
    ...(item.aliases || []),
  ]
    .map(normalizeText)
    .filter(Boolean);

  let score = 0;
  for (const field of fields) {
    if (!field) continue;
    if (field === q) score = Math.max(score, 520);
    else if (field.startsWith(q)) score = Math.max(score, 320);
    else if (field.includes(q)) score = Math.max(score, 210);
    else if (parts.length > 1 && parts.every((part) => field.includes(part)))
      score = Math.max(score, 180);
    else if (parts.some((part) => part.length >= 4 && field.includes(part)))
      score = Math.max(score, 80);
  }
  return score;
}

function rankResults(items, query) {
  const q = normalizeText(query);
  const queryHasNumber = hasHouseNumber(query);
  const stopQuery = looksLikeStopQuery(query);

  return items
    .map((item) => {
      const source = item.source || "unknown";
      const type = item.type || "poi";
      let score = Number(item.score || 0);

      score += textScore(item, query);
      score += Number(item.priority || 0);
      score += TYPE_WEIGHT[type] || 45;
      score += SOURCE_WEIGHT[source] || 0;

      // When user typed a house number, real address/known exact local POI should win.
      if (queryHasNumber) {
        if (type === "address") score += 190;
        if (source === "nominatim") score += 70;
        if (source === "local_poi" && textScore(item, query) >= 180)
          score += 120;
        if (
          type === "poi" &&
          source !== "local_poi" &&
          textScore(item, query) < 180
        )
          score -= 140;
        if (type === "stop") score -= 160;
      }

      // Stops are fallback unless user clearly searches for a stop/station.
      if (type === "stop") {
        if (stopQuery) score += 120;
        else score -= 80;
      }

      // Avoid irrelevant local priority items leaking into unrelated searches.
      if (source === "local_poi" && textScore(item, query) < 80) {
        score -= 260;
      }

      // Exact local priority POI must stay on top.
      if (source === "local_poi" && textScore(item, query) >= 320) {
        score += 220;
      }

      return { ...item, score: Math.round(score) };
    })
    .filter((item) => item.score > 70)
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.title).localeCompare(String(b.title), "lt"),
    );
}

function distanceMeters(a, b) {
  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function dedupeResults(items) {
  const out = [];
  for (const item of items) {
    const title = normalizeText(item.title || item.name);
    const subtitle = normalizeText(item.subtitle || "");
    const nearDuplicate = out.find((existing) => {
      const existingTitle = normalizeText(existing.title || existing.name);
      const existingSubtitle = normalizeText(existing.subtitle || "");
      const sameTitle =
        title &&
        existingTitle &&
        (title === existingTitle ||
          title.includes(existingTitle) ||
          existingTitle.includes(title));
      const sameSubtitle =
        subtitle && existingSubtitle && subtitle === existingSubtitle;
      const close = distanceMeters(item, existing) <= 65;
      return (sameTitle && close) || (sameSubtitle && close);
    });

    if (!nearDuplicate) {
      out.push(item);
      continue;
    }

    // Keep higher priority/source result when duplicates exist.
    const currentPower =
      (SOURCE_WEIGHT[item.source] || 0) +
      (TYPE_WEIGHT[item.type] || 0) +
      Number(item.priority || 0) +
      Number(item.score || 0);
    const existingPower =
      (SOURCE_WEIGHT[nearDuplicate.source] || 0) +
      (TYPE_WEIGHT[nearDuplicate.type] || 0) +
      Number(nearDuplicate.priority || 0) +
      Number(nearDuplicate.score || 0);
    if (currentPower > existingPower) {
      const index = out.indexOf(nearDuplicate);
      out[index] = item;
    }
  }
  return out;
}

module.exports = { rankResults, dedupeResults };
