const fs = require('fs');
const path = require('path');
const { getPool } = require('../../db/pool');

const STORE_PATH = path.resolve(__dirname, '../../data/parent-store.json');

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { parents: [], children: [], savedPlaces: [], trustedRoutes: [], activeTrips: [], tripEvents: [] };
    const raw = fs.readFileSync(STORE_PATH, 'utf8').trim();
    return raw ? JSON.parse(raw) : { parents: [], children: [], savedPlaces: [], trustedRoutes: [], activeTrips: [], tripEvents: [] };
  } catch {
    return { parents: [], children: [], savedPlaces: [], trustedRoutes: [], activeTrips: [], tripEvents: [] };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

async function ensureParent({ parentId, email, displayName }) {
  if (useDatabase()) {
    const pool = getPool();
    const result = await pool.query(
      `insert into parent_users (id, email, display_name)
       values ($1, $2, $3)
       on conflict (id) do update set email = coalesce(excluded.email, parent_users.email), display_name = coalesce(excluded.display_name, parent_users.display_name), updated_at = now()
       returning *`,
      [parentId, email || null, displayName || null],
    );
    return result.rows[0];
  }

  const store = readStore();
  const existing = store.parents.find((item) => item.id === parentId);
  if (existing) {
    existing.email = email || existing.email || null;
    existing.displayName = displayName || existing.displayName || null;
    existing.updatedAt = new Date().toISOString();
    writeStore(store);
    return existing;
  }
  const parent = { id: parentId, email: email || null, displayName: displayName || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.parents.push(parent);
  writeStore(store);
  return parent;
}

async function getDashboard(parentId) {
  if (useDatabase()) {
    const pool = getPool();
    const [children, savedPlaces, activeTrips, events] = await Promise.all([
      pool.query('select * from child_profiles where parent_id = $1 order by created_at desc', [parentId]),
      pool.query('select * from saved_places where parent_id = $1 order by sort_order asc, created_at desc', [parentId]),
      pool.query('select * from child_trips where parent_id = $1 and status in ($2,$3,$4) order by created_at desc', [parentId, 'planned', 'active', 'paused']),
      pool.query('select * from trip_events where parent_id = $1 order by created_at desc limit 50', [parentId]),
    ]);
    return { children: children.rows, savedPlaces: savedPlaces.rows, activeTrips: activeTrips.rows, recentEvents: events.rows };
  }

  const store = readStore();
  return {
    children: store.children.filter((item) => item.parentId === parentId),
    savedPlaces: store.savedPlaces.filter((item) => item.parentId === parentId),
    activeTrips: store.activeTrips.filter((item) => item.parentId === parentId && ['planned', 'active', 'paused'].includes(item.status)),
    recentEvents: store.tripEvents.filter((item) => item.parentId === parentId).slice(-50).reverse(),
  };
}

module.exports = { ensureParent, getDashboard, readStore, writeStore, useDatabase };
