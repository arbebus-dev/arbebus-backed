const express = require('express');
const controller = require('./routing.controller');
const router = express.Router();

router.get('/', controller.index);
router.post('/walk', controller.walk);

module.exports = router;
