-- Arbebus PRO search indexes. Run in TablePlus once.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_addresses_name_trgm
ON public.addresses
USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_trgm
ON public.addresses
USING gin (street gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_city_trgm
ON public.addresses
USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_house_number
ON public.addresses (house_number);

CREATE INDEX IF NOT EXISTS idx_addresses_city
ON public.addresses (city);
