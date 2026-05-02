const repo = require('./user.repository');
function listUsers() { return { ok: true, users: repo.listUsers() }; }
function upsertUser(user) { return { ok: true, user: repo.upsertUser(user) }; }
module.exports = { listUsers, upsertUser };
