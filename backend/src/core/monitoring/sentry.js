const { env } = require('../config/env');

function initSentry() {
  if (!env.SENTRY_DSN) return { enabled: false };
  return { enabled: true, dsnConfigured: true };
}

function captureException(error, context = {}) {
  console.error('[sentry]', error?.message || error, context);
}

module.exports = { initSentry, captureException };
