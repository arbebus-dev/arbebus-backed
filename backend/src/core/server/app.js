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

  // Existing routes
  app.use("/api", routes);
  app.use("/", routes);

  // Direct search routes fallback/fix for Render deployments.
  app.use("/api/search", searchRoutes);
  app.use("/search", searchRoutes);

  // Direct transit routes fallback/fix
  // Ensures:
  // /api/transit/live-buses
  // /api/transit/plan
  // /api/transit/departures
  // /api/transit/vehicle/:id
  app.use("/api/transit", transitRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
