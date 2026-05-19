-- Arbebus Apple-level normalized address indexes
-- Run after: npm run addresses:rebuild

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS idx_addresses_lower_name_pattern
ON public.addresses (lower(name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_lower_street_pattern
ON public.addresses (lower(street) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_lower_city_pattern
ON public.addresses (lower(city) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_lower_house_number
ON public.addresses (lower(house_number));

CREATE INDEX IF NOT EXISTS idx_addresses_street_house_city
ON public.addresses (lower(street), lower(house_number), lower(city));

CREATE INDEX IF NOT EXISTS idx_addresses_lower_name_gist_trgm
ON public.addresses USING gist (lower(name) gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_lower_street_gist_trgm
ON public.addresses USING gist (lower(street) gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_name_gin_trgm
ON public.addresses USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_gin_trgm
ON public.addresses USING gin (street gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_valid_lat_lon
ON public.addresses (lat, lon);

ANALYZE public.addresses;
