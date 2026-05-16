const express = require("express");
const { getPool } = require("../../db/pool");

const routes = require("../../api/routes");
const transitRoutes = require("../../api/routes/transit.router");
const searchRoutes = require("../../api/routes/search.router");
const parentRoutes = require("../../modules/parent/parent.router");
const childRoutes = require("../../modules/child/child.router");
const tripsRoutes = require("../../modules/trips/trips.router");
const ferryRoutes = require("../../modules/ferries/ferry.routes");
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

  app.get("/db-test", async (_req, res, next) => {
    try {
      const pool = getPool();

      const result = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM adr_pat) AS adr_pat,
          (SELECT COUNT(*) FROM adr_stat) AS adr_stat,
          (SELECT COUNT(*) FROM adr_gatves) AS adr_gatves,
          (SELECT COUNT(*) FROM adr_gyvenvietoves) AS adr_gyvenvietoves,
          (SELECT COUNT(*) FROM adr_savivaldybes) AS adr_savivaldybes,
          (SELECT COUNT(*) FROM adr_seniunijos) AS adr_seniunijos
      `);

      res.json({
        ok: true,
        database: "connected",
        counts: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  });

  // Direct Render-safe routes. Keep these BEFORE the catch-all /api router.
  app.use("/api/search", searchRoutes);
  app.use("/search", searchRoutes);
  app.use("/api/places/search", searchRoutes);
  app.use("/api/stops/search", searchRoutes);

  app.use("/api/transit", transitRoutes);
  app.use("/api/parent", parentRoutes);
  app.use("/api/child", childRoutes);
  app.use("/api/trips", tripsRoutes);
  app.use("/api/ferries", ferryRoutes);

  // Full API router and legacy aliases.
  app.use("/api", routes);
  app.use("/", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
