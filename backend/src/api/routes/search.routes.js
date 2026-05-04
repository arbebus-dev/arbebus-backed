const express = require("express");
const controller = require("../../modules/search/search.controller");

const router = express.Router();

const mainSearchHandler =
  controller.search ||
  controller.index ||
  controller.searchPlaces ||
  controller.handleSearch;

if (typeof mainSearchHandler !== "function") {
  console.log("[search.routes] controller keys:", Object.keys(controller));
  throw new Error(
    "Search controller does not export search/index/searchPlaces/handleSearch",
  );
}

router.get("/health", controller.health);
router.get("/debug", controller.debug);
router.get("/reverse", controller.reverse || mainSearchHandler);

router.get("/", mainSearchHandler);
router.post("/", mainSearchHandler);

router.get("/places", mainSearchHandler);
router.get("/stops", controller.stops || mainSearchHandler);

module.exports = router;
