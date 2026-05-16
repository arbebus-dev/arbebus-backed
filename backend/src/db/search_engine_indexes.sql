-- Arbebus 100% Apple Maps search indexes
-- Safe: creates indexes only; does not delete/update data.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- public.addresses: existing search source with good house numbers
CREATE INDEX IF NOT EXISTS idx_addresses_street_prefix_v100
ON public.addresses (lower((street)::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_house_prefix_v100
ON public.addresses (upper((house_number)::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_city_prefix_v100
ON public.addresses (lower((city)::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_trgm_v100
ON public.addresses USING gin (lower((street)::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_name_trgm_v100
ON public.addresses USING gin (lower((name)::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_valid_coords_v100
ON public.addresses (lower((city)::text), lower((street)::text), upper((house_number)::text))
WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0;

-- addresses_rc_import: imported RC fallback/source
CREATE INDEX IF NOT EXISTS idx_addresses_rc_street_prefix_v100
ON public.addresses_rc_import (lower((street)::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_rc_house_prefix_v100
ON public.addresses_rc_import (upper((house_number)::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_rc_city_prefix_v100
ON public.addresses_rc_import (lower((city)::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_rc_street_trgm_v100
ON public.addresses_rc_import USING gin (lower((street)::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_rc_name_trgm_v100
ON public.addresses_rc_import USING gin (lower((name)::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_rc_valid_coords_v100
ON public.addresses_rc_import (lower((city)::text), lower((street)::text), upper((house_number)::text))
WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0;

ANALYZE public.addresses;
ANALYZE public.addresses_rc_import;
