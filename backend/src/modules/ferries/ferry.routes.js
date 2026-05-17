const express = require("express");
const controller = require("./ferry.controller");

const router = express.Router();

router.get("/", controller.overview);
router.get("/health", controller.health);
router.get("/routes", controller.routes);
router.get("/schedule", controller.schedule);
router.get("/next", controller.nextDepartures);
router.get("/live", controller.live);

module.exports = router;
