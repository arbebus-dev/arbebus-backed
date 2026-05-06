const express = require('express');
const health = require('../../core/monitoring/health.controller');
const readiness = require('../../core/monitoring/readiness.controller');

const router = express.Router();

router.get('/', health.health);
router.get('/ready', readiness.readiness);
router.get('/live', health.health);

module.exports = router;
