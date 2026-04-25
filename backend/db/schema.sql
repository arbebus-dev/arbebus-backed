CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS transit;

CREATE TABLE IF NOT EXISTS transit.import_runs (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT,
  source_hash TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  agency_id TEXT,
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
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)) STORED
);

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
  point_count INTEGER DEFAULT 0,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transit.shape_points (
  shape_id TEXT NOT NULL REFERENCES transit.shapes(shape_id) ON DELETE CASCADE,
  shape_pt_sequence INTEGER NOT NULL,
  shape_pt_lat DOUBLE PRECISION NOT NULL,
  shape_pt_lon DOUBLE PRECISION NOT NULL,
  shape_dist_traveled DOUBLE PRECISION,
  import_run_id BIGINT REFERENCES transit.import_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE INDEX IF NOT EXISTS idx_transit_stops_geom ON transit.stops USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_transit_stops_name ON transit.stops USING GIN (to_tsvector('simple', stop_name));
CREATE INDEX IF NOT EXISTS idx_transit_routes_short_name ON transit.routes(route_short_name);
CREATE INDEX IF NOT EXISTS idx_transit_trips_route_service ON transit.trips(route_id, service_id);
CREATE INDEX IF NOT EXISTS idx_transit_stop_times_stop_departure ON transit.stop_times(stop_id, departure_seconds);
CREATE INDEX IF NOT EXISTS idx_transit_stop_times_trip_sequence ON transit.stop_times(trip_id, stop_sequence);
CREATE INDEX IF NOT EXISTS idx_transit_shape_points_shape_seq ON transit.shape_points(shape_id, shape_pt_sequence);

DROP MATERIALIZED VIEW IF EXISTS transit.route_stop_pairs;
DROP MATERIALIZED VIEW IF EXISTS transit.service_days;

CREATE MATERIALIZED VIEW transit.service_days AS
WITH base_calendar AS (
  SELECT
    c.service_id,
    day::date AS service_date
  FROM transit.calendar c
  CROSS JOIN LATERAL generate_series(
    COALESCE(c.start_date, CURRENT_DATE - INTERVAL '30 days'),
    COALESCE(c.end_date, CURRENT_DATE + INTERVAL '365 days'),
    INTERVAL '1 day'
  ) AS day
  WHERE CASE EXTRACT(ISODOW FROM day)::int
    WHEN 1 THEN c.monday
    WHEN 2 THEN c.tuesday
    WHEN 3 THEN c.wednesday
    WHEN 4 THEN c.thursday
    WHEN 5 THEN c.friday
    WHEN 6 THEN c.saturday
    WHEN 7 THEN c.sunday
  END
), removed AS (
  SELECT service_id, service_date
  FROM transit.calendar_dates
  WHERE exception_type = 2
), added AS (
  SELECT service_id, service_date
  FROM transit.calendar_dates
  WHERE exception_type = 1
)
SELECT DISTINCT service_id, service_date
FROM (
  SELECT * FROM base_calendar
  EXCEPT
  SELECT * FROM removed
  UNION
  SELECT * FROM added
) x;

CREATE UNIQUE INDEX idx_service_days_unique ON transit.service_days(service_id, service_date);
CREATE INDEX idx_service_days_date_service ON transit.service_days(service_date, service_id);

CREATE MATERIALIZED VIEW transit.route_stop_pairs AS
SELECT DISTINCT
  tr.route_id,
  r.route_short_name,
  r.route_long_name,
  st.stop_id,
  s.stop_name,
  st.stop_sequence
FROM transit.stop_times st
JOIN transit.trips tr ON tr.trip_id = st.trip_id
JOIN transit.routes r ON r.route_id = tr.route_id
JOIN transit.stops s ON s.stop_id = st.stop_id;

CREATE INDEX idx_route_stop_pairs_stop ON transit.route_stop_pairs(stop_id);
CREATE INDEX idx_route_stop_pairs_route ON transit.route_stop_pairs(route_id);
