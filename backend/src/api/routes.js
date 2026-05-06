const express = require("express");
const healthRoutes = require("./routes/health.router");
const searchRoutes = require("./routes/search.router");
const transitRoutes = require("./routes/transit.router");
const routingRoutes = require("./routes/routing.router");
const alertsRoutes = require("./routes/alerts.router");
const parentRoutes = require("../modules/parent/parent.router");
const childRoutes = require("../modules/child/child.router");
const tripsRoutes = require("../modules/trips/trips.router");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/search", searchRoutes);
router.use("/places/search", searchRoutes);
router.use("/stops/search", searchRoutes);
router.use("/transit", transitRoutes);
router.use("/routing", routingRoutes);
router.use("/alerts", alertsRoutes);
router.use("/parent", parentRoutes);
router.use("/child", childRoutes);
router.use("/trips", tripsRoutes);

// Legacy aliases used by older Arbebus mobile builds.
router.get(
  "/live-buses",
  require("../modules/transit/transit.controller").liveBuses,
);

module.exports = router;
