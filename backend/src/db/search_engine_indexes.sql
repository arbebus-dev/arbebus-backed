-- Arbebus FINAL Lithuania geocoder indexes
-- SAFE: creates indexes/analyzes only. Does not delete/update data.
-- Run once in TablePlus / Render PostgreSQL.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Raw prefix indexes.
CREATE INDEX IF NOT EXISTS idx_rc_addr_street_lower_prefix_v130
ON public.addresses_rc_import (lower(street::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addr_city_lower_prefix_v130
ON public.addresses_rc_import (lower(city::text) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addr_house_upper_prefix_v130
ON public.addresses_rc_import (upper(house_number::text) text_pattern_ops);

-- Accent-insensitive prefix expression indexes. Must match backend expression exactly.
CREATE INDEX IF NOT EXISTS idx_rc_addr_norm_street_prefix_v130
ON public.addresses_rc_import (
  btrim(regexp_replace(translate(lower(coalesce(street::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) text_pattern_ops
);

CREATE INDEX IF NOT EXISTS idx_rc_addr_norm_city_prefix_v130
ON public.addresses_rc_import (
  btrim(regexp_replace(translate(lower(coalesce(city::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) text_pattern_ops
);

-- Details/id lookup.
CREATE INDEX IF NOT EXISTS idx_rc_addr_id_text_v130
ON public.addresses_rc_import ((id::text));

-- Optional trigram safety for later long/typo queries.
CREATE INDEX IF NOT EXISTS idx_rc_addr_street_trgm_v130
ON public.addresses_rc_import USING gin (lower(street::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_rc_addr_city_trgm_v130
ON public.addresses_rc_import USING gin (lower(city::text) gin_trgm_ops);

ANALYZE public.addresses_rc_import;

-- Smoke tests after running this file:
-- EXPLAIN ANALYZE SELECT id, city, lat, lon FROM public.addresses_rc_import
-- WHERE btrim(regexp_replace(translate(lower(coalesce(city::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) LIKE 'slengiai%'
-- LIMIT 10;
--
-- EXPLAIN ANALYZE SELECT id, street, city, lat, lon FROM public.addresses_rc_import
-- WHERE btrim(regexp_replace(translate(lower(coalesce(street::text, '')), 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ', 'aceeisuuzACEEISUUZ'), '[^a-z0-9]+', ' ', 'g')) LIKE 'laivu%'
-- LIMIT 10;
