const { searchLocal } = require('./search.service');

function search(query, options = {}) {
  return searchLocal(query, options.limit || 12);
}

module.exports = { search };
