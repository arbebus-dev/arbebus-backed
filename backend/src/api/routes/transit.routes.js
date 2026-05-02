const express = require('express');
const controller = require('../../modules/transit/transit.controller');

const router = express.Router();

router.get('/', controller.index);
router.post('/plan', controller.plan);
router.get('/plan', controller.plan);
router.get('/live-buses', controller.liveBuses);
router.get('/vehicles', controller.liveBuses);
router.get('/live-eta', controller.liveEta);
router.get('/shape/:shapeId', controller.shape);
router.get('/alerts', controller.alerts);
router.get('/trip-updates', controller.tripUpdates);

module.exports = router;
