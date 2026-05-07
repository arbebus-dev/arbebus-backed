/* eslint-env node */
const path = require("path");
const dotenv = require("dotenv");
const { logger } = require("./logging/logger");

if (process.env.NODE_ENV !== "production") {
  const envPath = path.resolve(__dirname, "../../../infrastructure/.env");
  const envResult = dotenv.config({ path: envPath });

  if (envResult.error) {
    logger.warn(
      `[env] infrastructure/.env not loaded: ${envResult.error.message}`,
    );
  } else {
    logger.info(
      `[env] loaded ${Object.keys(envResult.parsed || {}).length} keys from ${envPath}`,
    );
  }
}

const { createApp } = require("./server/app");
const { env } = require("./config/env");
const { initSentry } = require("./monitoring/sentry");
const { initPeriodicRebuild } = require("../modules/search/cache/indexRebuild");

initSentry();

const app = createApp();

const PORT = process.env.PORT || env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT, nodeEnv: env.NODE_ENV }, "Arbebus backend started");

  // Initialize periodic search index rebuild
  initPeriodicRebuild().catch((err) => {
    logger.error(
      { error: err.message },
      "Failed to initialize search index rebuild",
    );
  });
});
