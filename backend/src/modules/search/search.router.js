const express = require('express');
const controller = require('./search.controller');
const router = express.Router();

router.get('/', controller.index);
router.get('/stops', controller.index);

module.exports = router;
