-- Arbebus search engine indexes for fast autocomplete and routing.
-- SAFE: this file only creates extensions/indexes and analyzes; it does not DELETE/UPDATE data.
-- Run once in Render PostgreSQL/TablePlus.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_addresses_street_lower
ON public.addresses (lower(street));

CREATE INDEX IF NOT EXISTS idx_addresses_street_lower_pattern
ON public.addresses (lower(street) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_trgm
ON public.addresses USING gin (lower(street) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_house_upper
ON public.addresses (upper(house_number));

CREATE INDEX IF NOT EXISTS idx_addresses_city_lower
ON public.addresses (lower(city));

CREATE INDEX IF NOT EXISTS idx_addresses_city_trgm
ON public.addresses USING gin (lower(city) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_house_city_fast
ON public.addresses (lower(street), upper(house_number), lower(city));

CREATE INDEX IF NOT EXISTS idx_addresses_missing_coords
ON public.addresses (city, street, house_number)
WHERE lat = 0 OR lon = 0 OR lat IS NULL OR lon IS NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_lat_lon
ON public.addresses (lat, lon);

ANALYZE public.addresses;

SELECT COUNT(*) AS addresses_count FROM public.addresses;
