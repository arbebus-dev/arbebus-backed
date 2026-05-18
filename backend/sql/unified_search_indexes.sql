-- Arbebus Unified Local Search indexes
-- Run once in TablePlus on the production PostgreSQL database.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_addresses_name_trgm
ON public.addresses
USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_street_trgm
ON public.addresses
USING gin (street gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_addresses_house_number
ON public.addresses (house_number);

CREATE INDEX IF NOT EXISTS idx_addresses_city
ON public.addresses (city);

CREATE INDEX IF NOT EXISTS idx_adr_gyvenvietoves_vardas_trgm
ON public.adr_gyvenvietoves
USING gin ("VARDAS" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_adr_gyvenvietoves_vardas_k_trgm
ON public.adr_gyvenvietoves
USING gin ("VARDAS_K" gin_trgm_ops);

-- Optional POI index. Run only if public.poi has a name column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'poi' AND column_name = 'name'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_poi_name_trgm
    ON public.poi
    USING gin (name gin_trgm_ops);
  END IF;
END $$;
