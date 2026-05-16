/* eslint-env node */
const { index } = require("./search.service");

function limitValue(value) {
  return Math.min(Math.max(Number(value || 8), 1), 12);
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

  const payload = await index({
    ...query,
    q,
    limit,
    external: "false",
    includeExternal: "false",
    autocomplete: "true",
    mode: "autocomplete",
  });

  const results = Array.isArray(payload.results) ? payload.results.slice(0, limit) : [];

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
      tookMs: Date.now() - startedAt,
    },
  };
}

module.exports = { autocomplete };
