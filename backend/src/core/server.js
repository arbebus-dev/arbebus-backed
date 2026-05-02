/* eslint-env node */
const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../../../infrastructure/.env");
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn(
    `[env] infrastructure/.env not loaded: ${envResult.error.message}`,
  );
} else {
  console.log(
    `[env] loaded ${Object.keys(envResult.parsed || {}).length} keys from ${envPath}`,
  );
}

const { createApp } = require("./server/app");
const { env } = require("./config/env");
const { logger } = require("./logging/logger");
const { initSentry } = require("./monitoring/sentry");

initSentry();

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, nodeEnv: env.NODE_ENV },
    "Arbebus backend started",
  );
});
