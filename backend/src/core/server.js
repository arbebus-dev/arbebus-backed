/* eslint-env node */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, "../../..", ".env"),
    path.resolve(__dirname, "../../..", "infrastructure", ".env"),
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;

    const envResult = dotenv.config({ path: envPath });

    if (envResult.error) {
      console.warn(`[env] ${envPath} not loaded: ${envResult.error.message}`);
      continue;
    }

    console.log(`[env] loaded ${Object.keys(envResult.parsed || {}).length} keys from ${envPath}`);
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[env] no .env file found in backend root. Using process.env only.");
  }
}

loadEnv();

const { logger } = require("./logging/logger");
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
