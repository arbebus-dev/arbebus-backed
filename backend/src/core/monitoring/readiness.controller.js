function readiness(_req, res) {
  res.json({ ok: true, ready: true, checks: { http: true }, timestamp: new Date().toISOString() });
}

module.exports = { readiness };
