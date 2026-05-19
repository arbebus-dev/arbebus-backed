-- Arbebus prepared address search index v7
-- Run this once in TablePlus after public.addresses has been rebuilt.
-- It creates a fast lookup table for Apple/Google-style address search:
-- query text -> normalized street/house -> nearest result by user GPS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.arbebus_norm(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    translate(
      lower(coalesce(value, '')),
      'ąčęėįšųūžĄČĘĖĮŠŲŪŽ',
      'aceeisuuzaceeisuuz'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.arbebus_lks94_to_wgs84(northing double precision, easting double precision)
RETURNS TABLE(latitude double precision, longitude double precision)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a double precision := 6378137.0;
  f double precision := 1.0 / 298.257222101;
  e2 double precision;
  ep2 double precision;
  k0 double precision := 0.9998;
  lon0 double precision := 24.0 * pi() / 180.0;
  x double precision;
  y double precision;
  m double precision;
  e1 double precision;
  mu double precision;
  j1 double precision;
  j2 double precision;
  j3 double precision;
  j4 double precision;
  fp double precision;
  sinfp double precision;
  cosfp double precision;
  tanfp double precision;
  c1 double precision;
  t1 double precision;
  n1 double precision;
  r1 double precision;
  d double precision;
  lat_rad double precision;
  lon_rad double precision;
BEGIN
  IF northing IS NULL OR easting IS NULL THEN
    latitude := NULL;
    longitude := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Already WGS84.
  IF northing BETWEEN 53 AND 57 AND easting BETWEEN 20 AND 27 THEN
    latitude := northing;
    longitude := easting;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Expected LKS-94 ranges in the current RC import: northing ~= 5.9M-6.3M, easting ~= 250k-700k.
  IF NOT (northing > 5000000 AND easting > 100000 AND easting < 900000) THEN
    latitude := NULL;
    longitude := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  e2 := f * (2.0 - f);
  ep2 := e2 / (1.0 - e2);
  x := easting - 500000.0;
  y := northing;
  m := y / k0;
  e1 := (1.0 - sqrt(1.0 - e2)) / (1.0 + sqrt(1.0 - e2));
  mu := m / (a * (1.0 - e2 / 4.0 - 3.0 * power(e2, 2) / 64.0 - 5.0 * power(e2, 3) / 256.0));
  j1 := 3.0 * e1 / 2.0 - 27.0 * power(e1, 3) / 32.0;
  j2 := 21.0 * power(e1, 2) / 16.0 - 55.0 * power(e1, 4) / 32.0;
  j3 := 151.0 * power(e1, 3) / 96.0;
  j4 := 1097.0 * power(e1, 4) / 512.0;
  fp := mu + j1 * sin(2.0 * mu) + j2 * sin(4.0 * mu) + j3 * sin(6.0 * mu) + j4 * sin(8.0 * mu);
  sinfp := sin(fp);
  cosfp := cos(fp);
  tanfp := tan(fp);
  c1 := ep2 * power(cosfp, 2);
  t1 := power(tanfp, 2);
  n1 := a / sqrt(1.0 - e2 * power(sinfp, 2));
  r1 := (a * (1.0 - e2)) / power(1.0 - e2 * power(sinfp, 2), 1.5);
  d := x / (n1 * k0);

  lat_rad := fp - (n1 * tanfp / r1) * (
    power(d, 2) / 2.0 -
    (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * power(c1, 2) - 9.0 * ep2) * power(d, 4) / 24.0 +
    (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * power(t1, 2) - 252.0 * ep2 - 3.0 * power(c1, 2)) * power(d, 6) / 720.0
  );

  lon_rad := lon0 + (
    d -
    (1.0 + 2.0 * t1 + c1) * power(d, 3) / 6.0 +
    (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * power(c1, 2) + 8.0 * ep2 + 24.0 * power(t1, 2)) * power(d, 5) / 120.0
  ) / cosfp;

  latitude := lat_rad * 180.0 / pi();
  longitude := lon_rad * 180.0 / pi();
  RETURN NEXT;
END;
$$;

DROP TABLE IF EXISTS public.addresses_search_lookup_next;

CREATE TABLE public.addresses_search_lookup_next AS
SELECT
  a.id::text AS id,
  a.name::text AS name,
  a.street::text AS street,
  a.house_number::text AS house_number,
  a.city::text AS city,
  a.postcode::text AS postcode,
  a.lat::double precision AS raw_lat,
  a.lon::double precision AS raw_lon,
  c.latitude::double precision AS latitude,
  c.longitude::double precision AS longitude,
  public.arbebus_norm(a.name::text) AS search_name,
  public.arbebus_norm(a.street::text) AS search_street,
  public.arbebus_norm(a.city::text) AS search_city,
  public.arbebus_norm(a.house_number::text) AS search_house
FROM public.addresses a
LEFT JOIN LATERAL public.arbebus_lks94_to_wgs84(a.lat::double precision, a.lon::double precision) c ON TRUE
WHERE a.street IS NOT NULL
  AND a.house_number IS NOT NULL
  AND c.latitude BETWEEN 53 AND 57
  AND c.longitude BETWEEN 20 AND 27;

DO $$
DECLARE
  row_count bigint;
BEGIN
  SELECT COUNT(*) INTO row_count FROM public.addresses_search_lookup_next;
  IF row_count < 500000 THEN
    RAISE EXCEPTION 'STOP: addresses_search_lookup_next has only % rows. Not swapping.', row_count;
  END IF;
END $$;

DROP TABLE IF EXISTS public.addresses_search_lookup_backup;
ALTER TABLE IF EXISTS public.addresses_search_lookup RENAME TO addresses_search_lookup_backup;
ALTER TABLE public.addresses_search_lookup_next RENAME TO addresses_search_lookup;

-- Base table indexes: keep these because details endpoint still reads public.addresses.
CREATE INDEX IF NOT EXISTS idx_addresses_house_number
ON public.addresses (house_number);

CREATE INDEX IF NOT EXISTS idx_addresses_id_text
ON public.addresses ((id::text));

-- Prepared lookup indexes: these are the critical speed layer.
CREATE INDEX IF NOT EXISTS idx_asl_house_street_prefix
ON public.addresses_search_lookup (house_number, search_street text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_asl_house_name_trgm
ON public.addresses_search_lookup USING gin (search_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_asl_street_prefix
ON public.addresses_search_lookup (search_street text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_asl_city_prefix
ON public.addresses_search_lookup (search_city text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_asl_lat_lon
ON public.addresses_search_lookup (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_asl_id
ON public.addresses_search_lookup (id);

ANALYZE public.addresses;
ANALYZE public.addresses_search_lookup;

SELECT COUNT(*) AS addresses_search_lookup_count
FROM public.addresses_search_lookup;

SELECT id, name, street, house_number, city, latitude, longitude
FROM public.addresses_search_lookup
WHERE search_street LIKE 'taikos%'
  AND house_number = '32'
ORDER BY city
LIMIT 20;

-- V8 performance index: lets backend search by normalized house number first,
-- then street prefix, before GPS ranking.
CREATE INDEX IF NOT EXISTS idx_asl_search_house_street_prefix
ON public.addresses_search_lookup (search_house, search_street text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_asl_search_house
ON public.addresses_search_lookup (search_house);

ANALYZE public.addresses_search_lookup;
