function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ą/g, "a")
    .replace(/č/g, "c")
    .replace(/ę/g, "e")
    .replace(/ė/g, "e")
    .replace(/į/g, "i")
    .replace(/š/g, "s")
    .replace(/ų/g, "u")
    .replace(/ū/g, "u")
    .replace(/ž/g, "z")
    // Keep house numbers and apartment/corpus separators: 32A, 10-2, 10/2.
    .replace(/[^a-z0-9\s.\-/]/g, " ")
    .replace(/\b(gatve|gatvė|gatvę|gatves|gatvės)\b/g, "g")
    .replace(/\b(prospektas|prospektą|prospekto|prospekt|pr\.)\b/g, "pr")
    .replace(/\b(plentas|plento|pl\.)\b/g, "pl")
    .replace(/\b(alėja|aleja|alėjos|alejos|al\.)\b/g, "al")
    .replace(/\b(stotele|stotelė|stoteles|stotelės|st\.)\b/g, "st")
    .replace(/\s+/g, " ")
    .trim();
}

function expandQuery(value, aliases = {}) {
  const q = normalizeText(value);
  const variants = new Set([q]);
  for (const [key, list] of Object.entries(aliases || {})) {
    const nk = normalizeText(key);
    if (q.includes(nk) || nk.includes(q)) {
      for (const item of list || []) variants.add(normalizeText(item));
    }
    for (const item of list || []) {
      const ni = normalizeText(item);
      if (q.includes(ni) || ni.includes(q)) variants.add(nk);
    }
  }
  return [...variants].filter(Boolean);
}

module.exports = { normalizeText, expandQuery };
