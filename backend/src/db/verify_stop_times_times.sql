-- Arbebus: patikrinimas per TablePlus, ar GTFS stop_times lentelė turi stotelių laikus.
-- Paleisti Render PostgreSQL duomenų bazėje.

-- 1) Ar lentelė egzistuoja?
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'transit'
    AND table_name = 'stop_times'
) AS stop_times_exists;

-- 2) Ar yra reikalingi stulpeliai?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'transit'
  AND table_name = 'stop_times'
  AND column_name IN (
    'trip_id',
    'stop_id',
    'stop_sequence',
    'arrival_time',
    'departure_time',
    'arrival_seconds',
    'departure_seconds'
  )
ORDER BY ordinal_position;

-- 3) Kiek eilučių yra stop_times lentelėje?
SELECT COUNT(*) AS stop_times_rows
FROM transit.stop_times;

-- 4) Ar realiai yra laikai?
SELECT
  COUNT(*) AS rows_total,
  COUNT(arrival_time) AS rows_with_arrival_time,
  COUNT(departure_time) AS rows_with_departure_time
FROM transit.stop_times;

-- 5) Pavyzdys: stotelės su laikais vienam reisui.
SELECT
  st.trip_id,
  st.stop_sequence,
  s.stop_name,
  st.arrival_time,
  st.departure_time
FROM transit.stop_times st
JOIN transit.stops s ON s.stop_id = st.stop_id
WHERE st.trip_id = (
  SELECT trip_id
  FROM transit.stop_times
  WHERE arrival_time IS NOT NULL OR departure_time IS NOT NULL
  LIMIT 1
)
ORDER BY st.stop_sequence
LIMIT 20;
