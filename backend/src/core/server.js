/* eslint-env node */
const path = require("path");
const dotenv = require("dotenv");

if (process.env.NODE_ENV !== "production") {
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
}

const { createApp } = require("./server/app");
const { env } = require("./config/env");
const { logger } = require("./logging/logger");
const { initSentry } = require("./monitoring/sentry");

initSentry();

const app = createApp();

const PORT = process.env.PORT || env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT, nodeEnv: env.NODE_ENV }, "Arbebus backend started");
});
