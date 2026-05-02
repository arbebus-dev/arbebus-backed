const { env } = require('../../core/config/env');
const routing = require('./routing.service');

async function directions(payload) {
  // ORS hook point. If ORS_API_KEY is not configured, return stable local fallback.
  return routing.directions({ ...payload, provider: env.ORS_API_KEY ? 'ors' : 'fallback' });
}

module.exports = { directions };
