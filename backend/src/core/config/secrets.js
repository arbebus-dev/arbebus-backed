const { env } = require('./env');

function getSecret(name, fallback = '') {
  return process.env[name] || env[name] || fallback;
}

module.exports = { getSecret };
