CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS transit;

CREATE TABLE IF NOT EXISTS transit.import_runs (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT,
  source_hash TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS transit.agencies (
  agency_id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  agency_url TEXT,
  agency_timezone TEXT,
  agency_lang TEXT,
  agency_phone TEXT,
  agency_fare_url TEXT,
  agency_email TEXT,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transit.routes (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES transit.agencies(agency_id) ON DELETE SET NULL,
  route_short_name TEXT,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER,
  route_color TEXT,
  route_text_color TEXT,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transit.stops (
  stop_id TEXT PRIMARY KEY,
  stop_code TEXT,
  stop_name TEXT NOT NULL,
  stop_desc TEXT,
  stop_lat DOUBLE PRECISION NOT NULL,
  stop_lon DOUBLE PRECISION NOT NULL,
  zone_id TEXT,
  stop_url TEXT,
  location_type INTEGER,
  parent_station TEXT,
  wheelchair_boarding INTEGER,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
  ) STORED,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transit_stops_geom ON transit.stops USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_transit_stops_name ON transit.stops (stop_name);

CREATE TABLE IF NOT EXISTS transit.calendar (
  service_id TEXT PRIMARY KEY,
  monday BOOLEAN NOT NULL DEFAULT FALSE,
  tuesday BOOLEAN NOT NULL DEFAULT FALSE,
  wednesday BOOLEAN NOT NULL DEFAULT FALSE,
  thursday BOOLEAN NOT NULL DEFAULT FALSE,
  friday BOOLEAN NOT NULL DEFAULT FALSE,
  saturday BOOLEAN NOT NULL DEFAULT FALSE,
  sunday BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transit.calendar_dates (
  service_id TEXT NOT NULL,
  service_date DATE NOT NULL,
  exception_type INTEGER NOT NULL,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (service_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_transit_calendar_dates_lookup
  ON transit.calendar_dates (service_id, service_date);

CREATE TABLE IF NOT EXISTS transit.trips (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES transit.routes(route_id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  trip_headsign TEXT,
  trip_short_name TEXT,
  direction_id INTEGER,
  block_id TEXT,
  shape_id TEXT,
  wheelchair_accessible INTEGER,
  bikes_allowed INTEGER,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transit_trips_route ON transit.trips (route_id);
CREATE INDEX IF NOT EXISTS idx_transit_trips_service ON transit.trips (service_id);
CREATE INDEX IF NOT EXISTS idx_transit_trips_shape ON transit.trips (shape_id);

CREATE TABLE IF NOT EXISTS transit.stop_times (
  trip_id TEXT NOT NULL REFERENCES transit.trips(trip_id) ON DELETE CASCADE,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT NOT NULL REFERENCES transit.stops(stop_id) ON DELETE CASCADE,
  stop_sequence INTEGER NOT NULL,
  pickup_type INTEGER,
  drop_off_type INTEGER,
  shape_dist_traveled DOUBLE PRECISION,
  arrival_seconds INTEGER,
  departure_seconds INTEGER,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (trip_id, stop_sequence)
);

CREATE INDEX IF NOT EXISTS idx_transit_stop_times_stop ON transit.stop_times (stop_id);
CREATE INDEX IF NOT EXISTS idx_transit_stop_times_trip_stop ON transit.stop_times (trip_id, stop_id);
CREATE INDEX IF NOT EXISTS idx_transit_stop_times_trip_departure ON transit.stop_times (trip_id, departure_seconds);
CREATE INDEX IF NOT EXISTS idx_transit_stop_times_stop_departure ON transit.stop_times (stop_id, departure_seconds);

CREATE TABLE IF NOT EXISTS transit.transfers (
  from_stop_id TEXT NOT NULL REFERENCES transit.stops(stop_id) ON DELETE CASCADE,
  to_stop_id TEXT NOT NULL REFERENCES transit.stops(stop_id) ON DELETE CASCADE,
  transfer_type INTEGER,
  min_transfer_time INTEGER,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (from_stop_id, to_stop_id)
);

CREATE TABLE IF NOT EXISTS transit.shapes (
  shape_id TEXT PRIMARY KEY,
  point_count INTEGER NOT NULL DEFAULT 0,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transit.shape_points (
  shape_id TEXT NOT NULL REFERENCES transit.shapes(shape_id) ON DELETE CASCADE,
  shape_pt_sequence INTEGER NOT NULL,
  shape_pt_lat DOUBLE PRECISION NOT NULL,
  shape_pt_lon DOUBLE PRECISION NOT NULL,
  shape_dist_traveled DOUBLE PRECISION,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(shape_pt_lon, shape_pt_lat), 4326)
  ) STORED,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE INDEX IF NOT EXISTS idx_transit_shape_points_shape_seq
  ON transit.shape_points (shape_id, shape_pt_sequence);
CREATE INDEX IF NOT EXISTS idx_transit_shape_points_geom
  ON transit.shape_points USING GIST (geom);

CREATE MATERIALIZED VIEW IF NOT EXISTS transit.service_days AS
SELECT
  c.service_id,
  gs::date AS service_date
FROM transit.calendar c
JOIN LATERAL generate_series(c.start_date, c.end_date, interval '1 day') AS gs ON TRUE
WHERE (
  (EXTRACT(ISODOW FROM gs) = 1 AND c.monday) OR
  (EXTRACT(ISODOW FROM gs) = 2 AND c.tuesday) OR
  (EXTRACT(ISODOW FROM gs) = 3 AND c.wednesday) OR
  (EXTRACT(ISODOW FROM gs) = 4 AND c.thursday) OR
  (EXTRACT(ISODOW FROM gs) = 5 AND c.friday) OR
  (EXTRACT(ISODOW FROM gs) = 6 AND c.saturday) OR
  (EXTRACT(ISODOW FROM gs) = 7 AND c.sunday)
)
UNION
SELECT service_id, service_date
FROM transit.calendar_dates
WHERE exception_type = 1
EXCEPT
SELECT service_id, service_date
FROM transit.calendar_dates
WHERE exception_type = 2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transit_service_days_unique
  ON transit.service_days (service_id, service_date);

CREATE MATERIALIZED VIEW IF NOT EXISTS transit.route_stop_pairs AS
SELECT DISTINCT
  t.route_id,
  st.stop_id
FROM transit.stop_times st
JOIN transit.trips t ON t.trip_id = st.trip_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transit_route_stop_pairs_unique
  ON transit.route_stop_pairs (route_id, stop_id);
