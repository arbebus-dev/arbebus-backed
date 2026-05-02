const express = require('express');
const controller = require('../../modules/routing/routing.controller');

const router = express.Router();

router.get('/', controller.index);
router.post('/directions', controller.directions);
router.get('/directions', controller.directions);
router.post('/walk', controller.walk);
router.get('/walk', controller.walk);

module.exports = router;
