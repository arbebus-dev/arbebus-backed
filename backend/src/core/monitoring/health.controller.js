const { API_VERSION } = require('../config/constants');

function health(_req, res) {
  res.json({ ok: true, status: 'healthy', service: 'arbebus-backend', version: API_VERSION, timestamp: new Date().toISOString() });
}

module.exports = { health };
