-- Arbebus search engine indexes for fast autocomplete.
-- Run once in Render PostgreSQL/TablePlus.

CREATE INDEX IF NOT EXISTS idx_addresses_street_lower
ON public.addresses (lower(street));

CREATE INDEX IF NOT EXISTS idx_addresses_house_upper
ON public.addresses (upper(house_number));

CREATE INDEX IF NOT EXISTS idx_addresses_city_lower
ON public.addresses (lower(city));

CREATE INDEX IF NOT EXISTS idx_addresses_street_house_city_fast
ON public.addresses (lower(street), upper(house_number), lower(city));

CREATE INDEX IF NOT EXISTS idx_addresses_lat_lon
ON public.addresses (lat, lon);
