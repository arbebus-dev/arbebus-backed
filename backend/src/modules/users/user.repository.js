const users = [];
function listUsers() { return users; }
function upsertUser(user) { const id = user.id || `user-${Date.now()}`; const item = { ...user, id }; users.push(item); return item; }
module.exports = { listUsers, upsertUser };
