const { directions } = require('./routing.service');
async function planWalk(payload) { return directions({ ...payload, mode: 'walking' }); }
module.exports = { planWalk };
