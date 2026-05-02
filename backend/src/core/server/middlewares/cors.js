const cors = require('cors');
const { env } = require('../../config/env');

module.exports = cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN });
