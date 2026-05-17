import { API_ENDPOINTS, apiUrl } from "@/constants/api";
import type { FerryDeparture, FerryOverview, FerryRoute, FerryTerminal, LiveFerry } from "../types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ferry API failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchFerryOverview(): Promise<FerryOverview> {
  const data = await fetchJson<Partial<FerryOverview>>(API_ENDPOINTS.ferries);
  return {
    ok: Boolean(data.ok),
    module: data.module,
    updatedAt: data.updatedAt,
    routes: Array.isArray(data.routes) ? data.routes : [],
    terminals: Array.isArray(data.terminals) ? data.terminals : [],
    nextDepartures: Array.isArray(data.nextDepartures) ? data.nextDepartures : [],
  };
}

export async function fetchFerryRoutes(): Promise<{
  routes: FerryRoute[];
  terminals: FerryTerminal[];
}> {
  const data = await fetchJson<{ routes?: FerryRoute[]; terminals?: FerryTerminal[] }>(
    API_ENDPOINTS.ferryRoutes,
  );
  return {
    routes: Array.isArray(data.routes) ? data.routes : [],
    terminals: Array.isArray(data.terminals) ? data.terminals : [],
  };
}

export async function fetchNextFerryDepartures(routeId?: string): Promise<FerryDeparture[]> {
  const url = routeId
    ? apiUrl(`/api/ferries/next?routeId=${encodeURIComponent(routeId)}`)
    : API_ENDPOINTS.ferryNext;
  const data = await fetchJson<{ nextDepartures?: FerryDeparture[] }>(url);
  return Array.isArray(data.nextDepartures) ? data.nextDepartures : [];
}


export async function fetchLiveFerries(routeId?: string): Promise<LiveFerry[]> {
  const url = routeId
    ? apiUrl(`/api/ferries/live?routeId=${encodeURIComponent(routeId)}`)
    : API_ENDPOINTS.ferryLive;
  const data = await fetchJson<{ ferries?: LiveFerry[] }>(url);
  return Array.isArray(data.ferries) ? data.ferries : [];
}
