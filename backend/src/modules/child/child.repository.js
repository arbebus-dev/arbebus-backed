const crypto = require('crypto');
const { getPool } = require('../../db/pool');
const parentStore = require('../parent/parent.repository');

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

async function createChild(parentId, data = {}) {
  if (parentStore.useDatabase()) {
    const pool = getPool();
    const result = await pool.query(
      `insert into child_profiles (id, parent_id, display_name, avatar_color, grade, notes)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [id('child'), parentId, data.displayName || data.name || 'Vaikas', data.avatarColor || '#22C55E', data.grade || null, data.notes || null],
    );
    return result.rows[0];
  }
  const store = parentStore.readStore();
  const child = { id: id('child'), parentId, displayName: data.displayName || data.name || 'Vaikas', avatarColor: data.avatarColor || '#22C55E', grade: data.grade || null, notes: data.notes || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.children.push(child);
  parentStore.writeStore(store);
  return child;
}

async function listChildren(parentId) {
  if (parentStore.useDatabase()) {
    const pool = getPool();
    const result = await pool.query('select * from child_profiles where parent_id = $1 order by created_at desc', [parentId]);
    return result.rows;
  }
  return parentStore.readStore().children.filter((item) => item.parentId === parentId);
}

module.exports = { createChild, listChildren };
