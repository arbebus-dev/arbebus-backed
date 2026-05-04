const express = require("express");
const routes = require("../../api/routes");
const transitRoutes = require("../../api/routes/transit.routes");
const searchRoutes = require("../../api/routes/search.routes");
const corsMiddleware = require("./middlewares/cors");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

function createApp() {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "arbebus-backend" });
  });

  // Direct Render-safe routes. Keep these BEFORE the catch-all /api router.
  app.use("/api/search", searchRoutes);
  app.use("/search", searchRoutes);
  app.use("/api/places/search", searchRoutes);
  app.use("/api/stops/search", searchRoutes);

  app.use("/api/transit", transitRoutes);

  // Full API router and legacy aliases.
  app.use("/api", routes);
  app.use("/", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
