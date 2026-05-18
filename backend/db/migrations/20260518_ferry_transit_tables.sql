-- Arbebus ferry + bus connector schema.
-- Safe to run multiple times in Render PostgreSQL / TablePlus.
CREATE TABLE IF NOT EXISTS public.ferry_terminals (
  id text PRIMARY KEY,
  name text NOT NULL,
  short_name text,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geom geometry(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferry_routes (
  id text PRIMARY KEY,
  route_code text UNIQUE,
  title text NOT NULL,
  from_terminal_id text REFERENCES public.ferry_terminals(id),
  to_terminal_id text REFERENCES public.ferry_terminals(id),
  duration_minutes integer NOT NULL DEFAULT 10,
  operator text,
  service_type text,
  ferry_line text,
  source_name text,
  source_url text,
  polyline jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferry_stop_times (
  id bigserial PRIMARY KEY,
  route_id text NOT NULL REFERENCES public.ferry_routes(id) ON DELETE CASCADE,
  stop_sequence integer NOT NULL,
  terminal_id text NOT NULL REFERENCES public.ferry_terminals(id),
  arrival_time time,
  departure_time time,
  UNIQUE(route_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS public.ferry_schedules (
  id bigserial PRIMARY KEY,
  route_id text NOT NULL REFERENCES public.ferry_routes(id) ON DELETE CASCADE,
  departure_time time NOT NULL,
  service_days text[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  season_from text,
  season_to text,
  note text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.ferry_live_positions (
  id bigserial PRIMARY KEY,
  route_id text REFERENCES public.ferry_routes(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'schedule_estimate',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  heading double precision,
  progress double precision,
  status text,
  departure_at timestamptz,
  arrival_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bus_routes (
  id text PRIMARY KEY,
  route_number text,
  title text NOT NULL,
  operator text,
  source text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bus_stops (
  id text PRIMARY KEY,
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geom geometry(Point, 4326),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bus_stop_times (
  id bigserial PRIMARY KEY,
  route_id text NOT NULL REFERENCES public.bus_routes(id) ON DELETE CASCADE,
  stop_id text NOT NULL REFERENCES public.bus_stops(id) ON DELETE CASCADE,
  stop_sequence integer NOT NULL,
  arrival_time time,
  departure_time time,
  service_days text[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  active boolean NOT NULL DEFAULT true,
  UNIQUE(route_id, stop_id, stop_sequence, departure_time)
);

CREATE INDEX IF NOT EXISTS idx_ferry_live_positions_route_updated ON public.ferry_live_positions(route_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ferry_schedules_route_departure ON public.ferry_schedules(route_id, departure_time);
CREATE INDEX IF NOT EXISTS idx_bus_stop_times_route_sequence ON public.bus_stop_times(route_id, stop_sequence);
