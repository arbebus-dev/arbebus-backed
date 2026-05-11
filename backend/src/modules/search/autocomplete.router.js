const express = require('express');
const service = require('./autocomplete.service');

const router = express.Router();

async function handle(req, res, next) {
  try {
    res.json(await service.autocomplete({ ...(req.query || {}), ...(req.body || {}) }));
  } catch (error) {
    next(error);
  }
}

router.get('/', handle);
router.post('/', handle);

module.exports = router;
