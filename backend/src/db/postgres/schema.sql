CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.addresses (
  id TEXT PRIMARY KEY,
  municipality TEXT,
  eldership TEXT,
  settlement TEXT,
  street TEXT,
  house_number TEXT,
  building_suffix TEXT,
  postal_code TEXT,
  full_address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOGRAPHY(Point, 4326),
  search_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_geom ON public.addresses USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_addresses_search_text ON public.addresses USING GIN (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_addresses_municipality ON public.addresses (municipality);
CREATE INDEX IF NOT EXISTS idx_addresses_street_house ON public.addresses (street, house_number);

CREATE TABLE IF NOT EXISTS public.pois (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOGRAPHY(Point, 4326),
  source TEXT,
  importance INTEGER DEFAULT 0,
  search_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pois_geom ON public.pois USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_pois_search_text ON public.pois USING GIN (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pois_category ON public.pois (category);
