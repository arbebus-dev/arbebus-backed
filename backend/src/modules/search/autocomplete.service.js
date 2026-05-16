/* eslint-env node */
const { index } = require("./search.service");

function limitValue(value) {
  return Math.min(Math.max(Number(value || 8), 1), 12);
}

function looksLikeAddressTyping(value = "") {
  const q = String(value || "").trim();
  if (q.length < 2) return false;
  return /\d/.test(q) || /^[a-ząčęėįšųūž\s.-]+$/i.test(q);
}

async function autocomplete(query = {}) {
  const startedAt = Date.now();
  const q = String(query.q || query.query || query.text || query.search || "").trim();
  const limit = limitValue(query.limit);

  if (q.length < 2) {
    return {
      ok: true,
      query: q,
      count: 0,
      results: [],
      suggestions: [],
      places: [],
      stops: [],
      addresses: [],
      meta: { tookMs: Date.now() - startedAt, autocomplete: true },
    };
  }

  const forceOfficialAddress = looksLikeAddressTyping(q);

  const payload = await index({
    ...query,
    q,
    limit,
    external: "false",
    includeExternal: "false",
    autocomplete: "true",
    mode: "autocomplete",
  });

  let results = Array.isArray(payload.results) ? payload.results : [];

  if (forceOfficialAddress) {
    results = results.filter((item) => String(item.type || "").toLowerCase() === "address");
  }

  results = results.slice(0, limit);

  return {
    ...payload,
    count: results.length,
    results,
    suggestions: results,
    places: results.filter((item) => item.type !== "stop"),
    stops: results.filter((item) => item.type === "stop"),
    addresses: results.filter((item) => item.type === "address"),
    meta: {
      ...(payload.meta || {}),
      autocomplete: true,
      addressAutocompleteOnly: forceOfficialAddress,
      tookMs: Date.now() - startedAt,
    },
  };
}

module.exports = { autocomplete };
