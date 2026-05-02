const express = require("express");
const controller = require("../../modules/search/search.controller");

const router = express.Router();

/**
 * GET /api/search?q=...
 * Bendras search: vietos + stotelės
 */
router.get("/", controller.index);

/**
 * POST /api/search
 * Body: { "q": "akropolis" }
 */
router.post("/", controller.index);

/**
 * GET /api/search/places?q=...
 * POI / places paieška
 */
router.get("/places", controller.places || controller.index);

/**
 * GET /api/search/stops?q=...
 * GTFS stops.txt realių stotelių paieška
 */
router.get("/stops", controller.stops);

module.exports = router;
