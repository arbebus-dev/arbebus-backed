const { env } = require("../config/env");
const { logger } = require("../logging/logger");

function initSentry() {
  if (!env.SENTRY_DSN) return { enabled: false };
  return { enabled: true, dsnConfigured: true };
}

function captureException(error, context = {}) {
  logger.error("[sentry]", error?.message || error, context);
}

module.exports = { initSentry, captureException };
