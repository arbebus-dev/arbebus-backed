const { allPlaces, searchLocal } = require('../search/search.service');

function listPoi() { return allPlaces(); }
function searchPoi(query, limit) { return searchLocal(query, limit); }

module.exports = { listPoi, searchPoi };
