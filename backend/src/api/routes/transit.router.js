/* eslint-env node */
const express = require('express');
const controller = require('../../modules/transit/transit.controller');

const router = express.Router();

// Module probe
router.get('/', controller.index);

// Real-time stops.lt vehicle positions
router.get('/live-buses', controller.liveBuses);
router.get('/vehicle-positions', controller.liveBuses);

// Live ETA calculated from live vehicle location + selected boarding stop
router.get('/live-eta', controller.liveEta);

// Apple Maps style route plan: GTFS stops/routes/trips/stop_times/shapes + live ETA payload
router.post('/plan', controller.plan);
router.get('/plan', controller.plan);

// GTFS shape/polyline for a route/trip
router.get('/routes', controller.routes);
router.get('/routes/:routeId/stops', controller.routeStops);
router.get('/routes/:routeId/shape', controller.routeShape);
router.get('/shape', controller.shape);
router.get('/shape/:shapeId', controller.shape);

// Departure board for a stop
router.get('/departures', controller.departures);
router.get('/stops/:stopId/departures', controller.departures);

// Station access / entrances-exits fallback for selected stop
router.get('/station-access', controller.stationAccess);
router.get('/stops/:stopId/station-access', controller.stationAccess);

// Vehicle details with nearest stop and departures context
router.get('/vehicle/:id', controller.vehicle);

// Existing realtime placeholders/alerts remain available
router.get('/alerts', controller.alerts);
router.get('/trip-updates', controller.tripUpdates);

module.exports = router;
