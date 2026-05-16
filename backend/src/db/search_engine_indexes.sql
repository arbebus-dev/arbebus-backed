-- Arbebus Instant Search PRO indexes.
-- SAFE: creates extensions/indexes and analyzes only. Does NOT delete/update data.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Lithuanian accent-normalized expression indexes for old official addresses table.
CREATE INDEX IF NOT EXISTS idx_addresses_norm_street_prefix
ON public.addresses (
  (lower(translate(COALESCE(street, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops
);

CREATE INDEX IF NOT EXISTS idx_addresses_norm_city_prefix
ON public.addresses (
  (lower(translate(COALESCE(city, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops
);

CREATE INDEX IF NOT EXISTS idx_addresses_house_upper_fast
ON public.addresses (upper(house_number));

CREATE INDEX IF NOT EXISTS idx_addresses_norm_street_house_city_fast
ON public.addresses (
  (lower(translate(COALESCE(street, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops,
  upper(house_number),
  (lower(translate(COALESCE(city, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops
)
WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0;

CREATE INDEX IF NOT EXISTS idx_addresses_valid_lat_lon
ON public.addresses (lat, lon)
WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0;

-- RC imported coordinate table indexes. Useful for street autocomplete fallback.
CREATE INDEX IF NOT EXISTS idx_rc_addresses_norm_street_prefix
ON public.addresses_rc_import (
  (lower(translate(COALESCE(street, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops
);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_norm_city_prefix
ON public.addresses_rc_import (
  (lower(translate(COALESCE(city, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops
);

CREATE INDEX IF NOT EXISTS idx_rc_addresses_house_upper_fast
ON public.addresses_rc_import (upper(house_number));

CREATE INDEX IF NOT EXISTS idx_rc_addresses_norm_street_house_city_fast
ON public.addresses_rc_import (
  (lower(translate(COALESCE(street, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops,
  upper(house_number),
  (lower(translate(COALESCE(city, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops
);

ANALYZE public.addresses;
ANALYZE public.addresses_rc_import;

SELECT COUNT(*) AS addresses_count FROM public.addresses;
SELECT COUNT(*) AS rc_addresses_count FROM public.addresses_rc_import;


-- Final Apple Maps autocomplete: real addresses first, prefix search only.
CREATE INDEX IF NOT EXISTS idx_addresses_autocomplete_address_prefix_fast
ON public.addresses (
  (lower(translate(COALESCE(street, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops,
  (lower(translate(COALESCE(city, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops,
  upper(house_number)
)
WHERE house_number IS NOT NULL AND house_number <> ''
  AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0;

CREATE INDEX IF NOT EXISTS idx_rc_addresses_autocomplete_address_prefix_fast
ON public.addresses_rc_import (
  (lower(translate(COALESCE(street, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops,
  (lower(translate(COALESCE(city, ''), 'ĄČĘĖĮŠŲŪŽąčęėįšųūž', 'ACEEISUUZaceeisuuz'))) text_pattern_ops,
  upper(house_number)
)
WHERE house_number IS NOT NULL AND house_number <> ''
  AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0;

ANALYZE public.addresses;
ANALYZE public.addresses_rc_import;
