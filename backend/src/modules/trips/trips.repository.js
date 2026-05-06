const crypto = require('crypto');
const { getPool } = require('../../db/pool');
const parentStore = require('../parent/parent.repository');

function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

async function savePlace(parentId, data = {}) {
  const coordinate = data.coordinate || { latitude: data.latitude, longitude: data.longitude };
  if (parentStore.useDatabase()) {
    const pool = getPool();
    const result = await pool.query(
      `insert into saved_places (id, parent_id, child_id, label, place_type, title, subtitle, latitude, longitude, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [id('place'), parentId, data.childId || null, data.label || data.placeType || 'Vieta', data.placeType || 'custom', data.title || data.name || 'Vieta', data.subtitle || null, Number(coordinate.latitude), Number(coordinate.longitude), data.metadata || {}],
    );
    return result.rows[0];
  }
  const store = parentStore.readStore();
  const place = { id: id('place'), parentId, childId: data.childId || null, label: data.label || data.placeType || 'Vieta', placeType: data.placeType || 'custom', title: data.title || data.name || 'Vieta', subtitle: data.subtitle || null, latitude: Number(coordinate.latitude), longitude: Number(coordinate.longitude), coordinate: { latitude: Number(coordinate.latitude), longitude: Number(coordinate.longitude) }, metadata: data.metadata || {}, createdAt: new Date().toISOString() };
  store.savedPlaces.push(place);
  parentStore.writeStore(store);
  return place;
}

async function startTrip(parentId, data = {}) {
  if (parentStore.useDatabase()) {
    const pool = getPool();
    const result = await pool.query(
      `insert into child_trips (id,parent_id,child_id,status,origin,destination,route_option,current_step_index,started_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,now()) returning *`,
      [id('trip'), parentId, data.childId || null, 'active', data.origin || {}, data.destination || {}, data.routeOption || {}, 0],
    );
    return result.rows[0];
  }
  const store = parentStore.readStore();
  const trip = { id: id('trip'), parentId, childId: data.childId || null, status: 'active', origin: data.origin || {}, destination: data.destination || {}, routeOption: data.routeOption || {}, currentStepIndex: 0, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.activeTrips.push(trip);
  store.tripEvents.push({ id: id('event'), parentId, childId: trip.childId, tripId: trip.id, type: 'trip_started', title: 'Kelionė pradėta', payload: {}, createdAt: new Date().toISOString() });
  parentStore.writeStore(store);
  return trip;
}

async function addTripEvent(parentId, tripId, data = {}) {
  if (parentStore.useDatabase()) {
    const pool = getPool();
    const result = await pool.query(
      `insert into trip_events (id,parent_id,child_id,trip_id,event_type,title,payload,latitude,longitude)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [id('event'), parentId, data.childId || null, tripId, data.type || data.eventType || 'status', data.title || 'Atnaujinimas', data.payload || {}, data.latitude || null, data.longitude || null],
    );
    return result.rows[0];
  }
  const store = parentStore.readStore();
  const event = { id: id('event'), parentId, childId: data.childId || null, tripId, type: data.type || data.eventType || 'status', title: data.title || 'Atnaujinimas', payload: data.payload || {}, latitude: data.latitude || null, longitude: data.longitude || null, createdAt: new Date().toISOString() };
  store.tripEvents.push(event);
  parentStore.writeStore(store);
  return event;
}

module.exports = { savePlace, startTrip, addTripEvent };
