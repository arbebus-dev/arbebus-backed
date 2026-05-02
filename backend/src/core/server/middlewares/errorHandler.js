const { logger } = require('../../logging/logger');

function notFound(req, res, _next) {
  res.status(404).json({ ok: false, error: 'Not found', path: req.originalUrl });
}

function errorHandler(error, _req, res, _next) {
  logger.error({ err: error }, 'Request failed');
  res.status(error.statusCode || 500).json({ ok: false, error: error.message || 'Internal server error' });
}

module.exports = { notFound, errorHandler };
