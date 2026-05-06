const express = require('express');
const controller = require('./trips.controller');
const router = express.Router();
router.post('/saved-places', controller.savePlace);
router.post('/start', controller.startTrip);
router.post('/:tripId/events', controller.event);
module.exports = router;
