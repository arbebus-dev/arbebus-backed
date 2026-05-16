-- Arbebus FINAL Search PRO indexes
-- Safe to run multiple times in TablePlus / Render PostgreSQL.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Existing public.addresses indexes used by fast local address provider.
CREATE INDEX IF NOT EXISTS idx_addresses_street_lower_pattern
ON public.addresses (lower(street) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_lower_trgm
ON public.addresses USING gin (lower(street) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_city_lower_pattern
ON public.addresses (lower(city) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_city_lower_trgm
ON public.addresses USING gin (lower(city) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_house_upper_pattern
ON public.addresses (upper(house_number) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_house_city_fast_v2
ON public.addresses (lower(street) text_pattern_ops, upper(house_number) text_pattern_ops, lower(city) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_valid_coords_v2
ON public.addresses (lower(city), lower(street), upper(house_number))
WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0;

-- RC imported address fallback indexes. These must not timeout even with 1M+ rows.
CREATE INDEX IF NOT EXISTS idx_rc_addresses_street_lower_pattern
ON public.addresses_rc_import (lower(street) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_street_lower_trgm
ON public.addresses_rc_import USING gin (lower(street) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_city_lower_pattern
ON public.addresses_rc_import (lower(city) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_city_lower_trgm
ON public.addresses_rc_import USING gin (lower(city) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_house_upper_pattern
ON public.addresses_rc_import (upper(house_number) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_street_house_city_fast_v2
ON public.addresses_rc_import (lower(street) text_pattern_ops, upper(house_number) text_pattern_ops, lower(city) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_lat_lon_v2
ON public.addresses_rc_import (lat, lon);

ANALYZE public.addresses;
ANALYZE public.addresses_rc_import;

SELECT COUNT(*) AS addresses_count FROM public.addresses;
SELECT COUNT(*) AS rc_addresses_count FROM public.addresses_rc_import;
