const express = require('express');
const controller = require('./transit.controller');
const router = express.Router();

router.get('/', controller.index);
router.post('/plan', controller.plan);
router.get('/live-buses', controller.liveBuses);
router.get('/live-eta', controller.liveEta);
router.get('/shape/:shapeId', controller.shape);

module.exports = router;
