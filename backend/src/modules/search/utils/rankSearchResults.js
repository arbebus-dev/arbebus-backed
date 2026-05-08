const { normalizeText } = require("./normalizeText");

const TYPE_WEIGHT = {
  school: 112,
  kindergarten: 108,
  sports_club: 104,
  district: 98,
  saved_place_template: 72,
  poi: 92,
  address: 130,
  street: 118,
  city: 54,
  region: 48,
  village: 48,
  station: 62,
  ferry: 62,
  stop: 18,
};

const SOURCE_WEIGHT = {
  local_address: 180,
  google_places: 150,
  nominatim: 128,
  local_poi: 115,
  overpass: 82,
  ors: 76,
  gtfs: 18,
  seed: 20,
};

function hasHouseNumber(query) {
  return /\b\d+[a-z]?\b/i.test(String(query || ""));
}

function hasStreetToken(query) {
  return /\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(
    String(query || ""),
  );
}

function looksLikeStopQuery(query) {
  const q = normalizeText(query);
  return /\b(st|stotele|stotel|stotis|autobus|bus|perone|st\.)\b/.test(q);
}

function queryParts(query) {
  return normalizeText(query)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !["g", "pr", "pl", "al", "lt", "lietuva"].includes(part));
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
    if (field === q) score = Math.max(score, 620);
    else if (field.startsWith(q)) score = Math.max(score, 390);
    else if (field.includes(q)) score = Math.max(score, 260);
    else if (parts.length > 1 && parts.every((part) => field.includes(part)))
      score = Math.max(score, 230);
    else if (parts.some((part) => part.length >= 4 && field.includes(part)))
      score = Math.max(score, 90);
  }
  return score;
}

function missingImportantQueryParts(item, query) {
  const parts = queryParts(query);
  if (!parts.length) return false;
  const field = normalizeText([
    item.title,
    item.name,
    item.subtitle,
    item.category,
    ...(item.keywords || []),
  ].join(" "));
  return !parts.every((part) => field.includes(part));
}

function rankResults(items, query) {
  const q = normalizeText(query);
  const queryHasNumber = hasHouseNumber(query);
  const streetQuery = hasStreetToken(query);
  const stopQuery = looksLikeStopQuery(query);

  return items
    .map((item) => {
      const source = item.source || "unknown";
      const type = item.type || "poi";
      const match = textScore(item, query);
      let score = Number(item.score || 0);

      score += match;
      score += Number(item.priority || 0);
      score += TYPE_WEIGHT[type] || 45;
      score += SOURCE_WEIGHT[source] || 0;

      // Address/street query must not jump to random villages/stops.
      if (streetQuery || queryHasNumber) {
        if (type === "address") score += 260;
        if (type === "street") score += queryHasNumber ? 80 : 240;
        if (source === "local_address") score += 260;
        if (source === "google_places" || source === "nominatim") score += 120;

        if (type === "stop" && !stopQuery) score -= 520;
        if (type === "city" || type === "region" || type === "village") score -= 420;

        if (missingImportantQueryParts(item, query)) score -= 520;
      }

      // When user typed a house number, exact addresses must win.
      if (queryHasNumber) {
        if (type === "address") score += 320;
        if (source === "local_address" && match >= 180) score += 240;
        if (source === "nominatim") score += 100;

        if (type === "poi" && source !== "local_poi" && match < 180) score -= 220;
        if (type === "street" && !String(item.title || "").match(/\d/)) score -= 80;
      }

      // Stops are fallback unless user clearly searches for a stop/station.
      if (type === "stop") {
        if (stopQuery) score += 160;
        else score -= 160;
      }

      // Avoid irrelevant local priority items leaking into unrelated searches.
      if (source === "local_poi" && match < 80) {
        score -= 280;
      }

      // Exact local priority POI must stay on top.
      if (source === "local_poi" && match >= 320 && !queryHasNumber) {
        score += 220;
      }

      return { ...item, score: Math.round(score) };
    })
    .filter((item) => item.score > 90)
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

module.exports = {
  rankResults,
  dedupeResults,
  textScore,
  hasHouseNumber,
  looksLikeStopQuery,
};
