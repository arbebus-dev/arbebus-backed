-- Arbebus ULTRA FAST Lithuania geocoder indexes + lookup tables
-- SAFE for source data: does NOT delete/update addresses_rc_import.
-- It rebuilds only derived lookup tables used by fast autocomplete.
-- Run in TablePlus / Render PostgreSQL after deploying this patch.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Fast expression indexes on the big source table for exact address lookup.
CREATE INDEX IF NOT EXISTS idx_rc_addr_norm_street_prefix_v140
ON public.addresses_rc_import (
  btrim(regexp_replace(translate(lower(coalesce(street::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) text_pattern_ops
);

CREATE INDEX IF NOT EXISTS idx_rc_addr_norm_city_prefix_v140
ON public.addresses_rc_import (
  btrim(regexp_replace(translate(lower(coalesce(city::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) text_pattern_ops
);

CREATE INDEX IF NOT EXISTS idx_rc_addr_house_upper_prefix_v140
ON public.addresses_rc_import (upper(house_number::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addr_id_text_v140
ON public.addresses_rc_import ((id::text));

-- 2) Derived settlement lookup table: one row per city/village/settlement.
CREATE TABLE IF NOT EXISTS public.addresses_search_settlements (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  city_norm TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  address_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

TRUNCATE public.addresses_search_settlements;

INSERT INTO public.addresses_search_settlements (id, city, city_norm, lat, lon, address_count, updated_at)
SELECT
  md5(city_norm)::text AS id,
  min(city::text) AS city,
  city_norm,
  avg(lat)::double precision AS lat,
  avg(lon)::double precision AS lon,
  count(*)::int AS address_count,
  now() AS updated_at
FROM (
  SELECT
    city,
    lat,
    lon,
    btrim(regexp_replace(translate(lower(coalesce(city::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) AS city_norm
  FROM public.addresses_rc_import
  WHERE city IS NOT NULL
    AND btrim(city::text) <> ''
    AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
) s
WHERE city_norm <> ''
GROUP BY city_norm;

CREATE INDEX IF NOT EXISTS idx_search_settlements_norm_prefix_v140
ON public.addresses_search_settlements (city_norm text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_search_settlements_count_v140
ON public.addresses_search_settlements (address_count DESC);

-- 3) Derived street lookup table: one row per street + settlement.
CREATE TABLE IF NOT EXISTS public.addresses_search_streets (
  id TEXT PRIMARY KEY,
  street TEXT NOT NULL,
  street_norm TEXT NOT NULL,
  city TEXT,
  city_norm TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  address_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

TRUNCATE public.addresses_search_streets;

INSERT INTO public.addresses_search_streets (id, street, street_norm, city, city_norm, lat, lon, address_count, updated_at)
SELECT
  md5(street_norm || '|' || city_norm)::text AS id,
  min(street::text) AS street,
  street_norm,
  min(city::text) AS city,
  city_norm,
  avg(lat)::double precision AS lat,
  avg(lon)::double precision AS lon,
  count(*)::int AS address_count,
  now() AS updated_at
FROM (
  SELECT
    street,
    city,
    lat,
    lon,
    btrim(regexp_replace(translate(lower(coalesce(street::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) AS street_norm,
    btrim(regexp_replace(translate(lower(coalesce(city::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) AS city_norm
  FROM public.addresses_rc_import
  WHERE street IS NOT NULL
    AND btrim(street::text) <> ''
    AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
) s
WHERE street_norm <> ''
GROUP BY street_norm, city_norm;

CREATE INDEX IF NOT EXISTS idx_search_streets_norm_prefix_v140
ON public.addresses_search_streets (street_norm text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_search_streets_city_norm_prefix_v140
ON public.addresses_search_streets (city_norm text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_search_streets_count_v140
ON public.addresses_search_streets (address_count DESC);

ANALYZE public.addresses_rc_import;
ANALYZE public.addresses_search_settlements;
ANALYZE public.addresses_search_streets;

-- Smoke tests. Expected after first warmup: <100ms, usually much faster.
-- EXPLAIN ANALYZE SELECT * FROM public.addresses_search_settlements WHERE city_norm LIKE 'slengiai%' LIMIT 10;
-- EXPLAIN ANALYZE SELECT * FROM public.addresses_search_settlements WHERE city_norm LIKE 'nida%' LIMIT 10;
-- EXPLAIN ANALYZE SELECT * FROM public.addresses_search_streets WHERE street_norm LIKE 'laivu%' LIMIT 10;
