const { allPlaces } = require('./search.service');

function buildIndex() {
  return allPlaces();
}

module.exports = { buildIndex };
