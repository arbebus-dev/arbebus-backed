-- Arbebus clean RC addresses final indexes
-- Run in TablePlus after rebuilding public.addresses from addresses_rc_import.

CREATE INDEX IF NOT EXISTS idx_addresses_name ON public.addresses(name);
CREATE INDEX IF NOT EXISTS idx_addresses_street ON public.addresses(street);
CREATE INDEX IF NOT EXISTS idx_addresses_city ON public.addresses(city);
CREATE INDEX IF NOT EXISTS idx_addresses_lat_lon ON public.addresses(lat, lon);

-- Optional but recommended for fast contains/autocomplete searches like '%taikos%32%'.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_addresses_name_trgm ON public.addresses USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_addresses_street_trgm ON public.addresses USING gin (street gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_addresses_city_trgm ON public.addresses USING gin (city gin_trgm_ops);
