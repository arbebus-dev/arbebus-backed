const { liveBuses } = require('../transit.service');
function getVehiclePositions() { return liveBuses(); }
module.exports = { getVehiclePositions };
