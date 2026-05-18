-- Arbebus ULTIMATE Search Engine indexes v4
-- Run ONCE in TablePlus / Render PostgreSQL.
-- Goal: instant autocomplete, exact house search, typo tolerance, stable ranking.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Exact house + street lookup: "Taikos 32", "Laivų 1".
CREATE INDEX IF NOT EXISTS idx_addresses_house_street_lower
ON public.addresses (lower(house_number), lower(street) text_pattern_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

-- Prefix autocomplete: lower(name/street/city) LIKE 'taikos%'.
CREATE INDEX IF NOT EXISTS idx_addresses_name_lower_pattern_valid
ON public.addresses (lower(name) text_pattern_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

CREATE INDEX IF NOT EXISTS idx_addresses_street_lower_pattern_valid
ON public.addresses (lower(street) text_pattern_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

CREATE INDEX IF NOT EXISTS idx_addresses_city_lower_pattern_valid
ON public.addresses (lower(city) text_pattern_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

-- Typo tolerance. These are used by ORDER BY lower(name/street) <-> query LIMIT n.
CREATE INDEX IF NOT EXISTS idx_addresses_name_lower_gist_trgm_valid
ON public.addresses USING gist (lower(name) gist_trgm_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

CREATE INDEX IF NOT EXISTS idx_addresses_street_lower_gist_trgm_valid
ON public.addresses USING gist (lower(street) gist_trgm_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

-- Optional contains/diagnostics indexes.
CREATE INDEX IF NOT EXISTS idx_addresses_name_gin_trgm_valid
ON public.addresses USING gin (lower(name) gin_trgm_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

CREATE INDEX IF NOT EXISTS idx_addresses_street_gin_trgm_valid
ON public.addresses USING gin (lower(street) gin_trgm_ops)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

-- Coordinate helper.
CREATE INDEX IF NOT EXISTS idx_addresses_lat_lon_valid
ON public.addresses (lat, lon)
WHERE lat BETWEEN 53 AND 57 AND lon BETWEEN 20 AND 27;

ANALYZE public.addresses;
