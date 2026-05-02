const express = require('express');
const controller = require('../../modules/alerts/alert.controller');

const router = express.Router();

router.get('/', controller.listAlerts);
router.get('/tokens', controller.listTokens);
router.post('/tokens', controller.registerToken);
router.delete('/tokens/:token', controller.unregisterToken);
router.post('/leave', controller.createLeaveAlert);
router.get('/leave', controller.listLeaveAlerts);
router.delete('/leave/:id', controller.deleteLeaveAlert);

module.exports = router;
