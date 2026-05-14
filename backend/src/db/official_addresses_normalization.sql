DROP TABLE IF EXISTS public.addresses;

CREATE TABLE public.addresses (
  id SERIAL PRIMARY KEY,
  street TEXT,
  house_number TEXT,
  city TEXT,
  postcode TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  full_text TEXT
);

-- indeksai
CREATE INDEX idx_addresses_street ON public.addresses USING gin (to_tsvector('simple', street));
CREATE INDEX idx_addresses_city ON public.addresses (city);
CREATE INDEX idx_addresses_lat_lon ON public.addresses (lat, lon);