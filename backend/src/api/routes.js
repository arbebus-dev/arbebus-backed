const express = require('express');
const healthRoutes = require('./routes/health.routes');
const searchRoutes = require('./routes/search.routes');
const transitRoutes = require('./routes/transit.routes');
const routingRoutes = require('./routes/routing.routes');
const alertsRoutes = require('./routes/alerts.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/search', searchRoutes);
router.use('/places/search', searchRoutes);
router.use('/stops/search', searchRoutes);
router.use('/transit', transitRoutes);
router.use('/routing', routingRoutes);
router.use('/alerts', alertsRoutes);

// Legacy aliases used by older Arbebus mobile builds.
router.get('/live-buses', require('../modules/transit/transit.controller').liveBuses);

module.exports = router;
