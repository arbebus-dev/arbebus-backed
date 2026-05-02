function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ė/g, 'e')
    .replace(/į/g, 'i')
    .replace(/[ųū]/g, 'u')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/č/g, 'c')
    .replace(/ą/g, 'a')
    .replace(/ę/g, 'e')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalizeText };
