-- Arbebus address coordinate fill
-- Run in Render PostgreSQL / TablePlus

ALTER TABLE addresses
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;

ALTER TABLE addresses
ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;

-- Example update from RC tables (adjust column names if needed)
-- This keeps existing coordinates and fills only missing/0 values

UPDATE addresses a
SET
  lat = COALESCE(a.lat, rc.lat, 0),
  lon = COALESCE(a.lon, rc.lon, 0)
FROM RC_atviri_adresai rc
WHERE
  (
    a.lat IS NULL OR a.lat = 0
    OR a.lon IS NULL OR a.lon = 0
  )
  AND lower(a.name) = lower(rc.adresas);

CREATE INDEX IF NOT EXISTS idx_addresses_lat_lon
ON addresses(lat, lon);