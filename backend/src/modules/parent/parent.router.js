const express = require('express');
const controller = require('./parent.controller');
const router = express.Router();
router.get('/dashboard', controller.dashboard);
router.post('/', controller.upsert);
router.get('/', controller.dashboard);
module.exports = router;
