const express = require('express');
const controller = require('./routing.controller');
const router = express.Router();

router.get('/', controller.index);
router.post('/directions', controller.directions);
router.post('/walk', controller.walk);

module.exports = router;
