import type {
  Coordinate,
  Place,
  PlaceSuggestion,
} from "../../features/rideBooking/models";

const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || "";
const ORS_GEOCODE_BASE = "https://api.openrouteservice.org/geocode";

const KLAIPEDA_FOCUS = {
  latitude: 55.7033,
  longitude: 21.1443,
};

type EncodedSuggestionPayload = {
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

function buildUrl(
  endpoint: "autocomplete" | "search" | "reverse",
  params: Record<string, string | number | undefined>
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      searchParams.append(key, String(value));
    }
  });

  return `${ORS_GEOCODE_BASE}/${endpoint}?${searchParams.toString()}`;
}

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function encodeSuggestionPayload(payload: EncodedSuggestionPayload) {
  return `ors:${encodeURIComponent(JSON.stringify(payload))}`;
}

function decodeSuggestionPayload(value: string): EncodedSuggestionPayload | null {
  try {
    if (!value.startsWith("ors:")) return null;

    const json = decodeURIComponent(value.slice(4));
    const parsed = JSON.parse(json);

    if (
      typeof parsed?.title === "string" &&
      typeof parsed?.subtitle === "string" &&
      typeof parsed?.latitude === "number" &&
      typeof parsed?.longitude === "number"
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFeatureTitle(feature: any) {
  const props = feature?.properties ?? {};

  const streetLine = [props.street, props.housenumber]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    props.name ||
    streetLine ||
    props.locality ||
    props.county ||
    props.region ||
    props.label ||
    "Unknown place"
  );
}

function getFeatureSubtitle(feature: any) {
  const props = feature?.properties ?? {};

  const localityLine = [props.postalcode, props.locality]
    .filter(Boolean)
    .join(" ")
    .trim();

  const regionLine = [props.county, props.region, props.country]
    .filter(Boolean)
    .join(", ")
    .trim();

  return [localityLine, regionLine].filter(Boolean).join(" • ") || props.label || "";
}

function featureToPlace(feature: any): Place {
  const coords = feature?.geometry?.coordinates ?? [0, 0];

  return {
    id:
      feature?.properties?.gid ||
      feature?.properties?.id ||
      `${coords[1]}-${coords[0]}`,
    title: getFeatureTitle(feature),
    subtitle: getFeatureSubtitle(feature),
    coordinate: {
      latitude: safeNumber(coords[1]),
      longitude: safeNumber(coords[0]),
    },
  };
}

function detectSuggestionKind(feature: any): PlaceSuggestion["kind"] {
  const props = feature?.properties ?? {};
  const layer = normalizeText(props.layer);
  const source = normalizeText(props.source);
  const category = normalizeText(props.category);
  const name = normalizeText(props.name);
  const label = normalizeText(props.label);

  const combined = `${layer} ${source} ${category} ${name} ${label}`;

  if (combined.includes("venue")) return "venue";
  if (combined.includes("address")) return "address";
  if (combined.includes("street")) return "street";
  if (combined.includes("locality")) return "locality";
  if (combined.includes("region")) return "region";
  if (
    combined.includes("station") ||
    combined.includes("bus") ||
    combined.includes("train")
  ) {
    return "station";
  }

  return "unknown";
}

function getAccentLabel(kind: PlaceSuggestion["kind"]) {
  if (kind === "venue") return "POI";
  if (kind === "address") return "Adresas";
  if (kind === "street") return "Gatvė";
  if (kind === "locality") return "Miestas";
  if (kind === "station") return "Stotelė";
  if (kind === "region") return "Regionas";
  return "";
}

function featureToSuggestion(feature: any): PlaceSuggestion {
  const coords = feature?.geometry?.coordinates ?? [0, 0];
  const title = getFeatureTitle(feature);
  const subtitle = getFeatureSubtitle(feature);
  const kind = detectSuggestionKind(feature);

  return {
    id: encodeSuggestionPayload({
      title,
      subtitle,
      latitude: safeNumber(coords[1]),
      longitude: safeNumber(coords[0]),
    }),
    title,
    subtitle,
    kind,
    source: "ors",
    accentLabel: getAccentLabel(kind),
  };
}

function dedupeSuggestions(items: PlaceSuggestion[]) {
  const map = new Map<string, PlaceSuggestion>();

  items.forEach((item) => {
    const key = normalizeText(`${item.title}|${item.subtitle}`);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
}

function scoreSuggestion(query: string, item: PlaceSuggestion) {
  const normalizedQuery = normalizeText(query);
  const title = normalizeText(item.title);
  const subtitle = normalizeText(item.subtitle);
  const combined = `${title} ${subtitle}`.trim();
  const decoded = decodeSuggestionPayload(item.id);

  let score = 0;

  if (title === normalizedQuery) score += 120;
  if (title.startsWith(normalizedQuery)) score += 90;
  if (combined.startsWith(normalizedQuery)) score += 55;
  if (title.includes(normalizedQuery)) score += 28;
  if (combined.includes(normalizedQuery)) score += 16;

  if (subtitle.includes("klaip")) score += 18;
  if (title.includes("klaip")) score += 20;

  if (/\d/.test(title)) score += 10;

  if (decoded) {
    const meters = distanceMeters(KLAIPEDA_FOCUS, {
      latitude: decoded.latitude,
      longitude: decoded.longitude,
    });

    if (meters < 2500) score += 16;
    else if (meters < 8000) score += 10;
    else if (meters < 25000) score += 4;
  }

  return score;
}

function rankSuggestions(query: string, items: PlaceSuggestion[]) {
  return [...items]
    .map((item) => ({
      item,
      score: scoreSuggestion(query, item),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
    .slice(0, 12);
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: ORS_API_KEY,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Geocoder error ${response.status}: ${text}`);
  }

  return response.json();
}

async function fetchFeatures(
  endpoint: "autocomplete" | "search",
  params: Record<string, string | number | undefined>
) {
  const url = buildUrl(endpoint, params);
  const json = await fetchJson(url);
  return Array.isArray(json?.features) ? json.features : [];
}

export const placeSearchService = {
  async autocomplete(query: string): Promise<PlaceSuggestion[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return [];
    }

    if (!ORS_API_KEY) {
      console.log("placeSearchService.autocomplete: missing ORS API key");
      return [];
    }

    try {
      const commonParams = {
        api_key: ORS_API_KEY,
        text: normalizedQuery,
        size: 12,
        "boundary.country": "LT",
        "focus.point.lon": KLAIPEDA_FOCUS.longitude,
        "focus.point.lat": KLAIPEDA_FOCUS.latitude,
      };

      const [autocompleteFeatures, addressFeatures, venueFeatures] =
        await Promise.all([
          fetchFeatures("autocomplete", {
            ...commonParams,
            layers: "address,street,venue,locality,region",
          }),
          fetchFeatures("search", {
            ...commonParams,
            layers: "address,street,locality",
          }),
          fetchFeatures("search", {
            ...commonParams,
            layers: "venue",
          }),
        ]);

      const suggestions = dedupeSuggestions(
        [...autocompleteFeatures, ...addressFeatures, ...venueFeatures].map(
          featureToSuggestion
        )
      );

      return rankSuggestions(normalizedQuery, suggestions);
    } catch (error) {
      console.log("placeSearchService.autocomplete error:", error);
      return [];
    }
  },

  async resolvePlace(id: string): Promise<Place> {
    const decoded = decodeSuggestionPayload(id);

    if (decoded) {
      return {
        id,
        title: decoded.title,
        subtitle: decoded.subtitle,
        coordinate: {
          latitude: decoded.latitude,
          longitude: decoded.longitude,
        },
      };
    }

    if (!ORS_API_KEY) {
      throw new Error("Missing ORS API key");
    }

    try {
      const searchUrl = buildUrl("search", {
        api_key: ORS_API_KEY,
        text: id,
        size: 1,
        "boundary.country": "LT",
        "focus.point.lon": KLAIPEDA_FOCUS.longitude,
        "focus.point.lat": KLAIPEDA_FOCUS.latitude,
      });

      const json = await fetchJson(searchUrl);
      const feature = json?.features?.[0];

      if (!feature) {
        throw new Error("Place not found");
      }

      return featureToPlace(feature);
    } catch (error) {
      console.log("placeSearchService.resolvePlace error:", error);
      throw error;
    }
  },

  async reverseGeocode(coordinate: Coordinate): Promise<Place> {
    const fallback: Place = {
      id: `current-${coordinate.latitude}-${coordinate.longitude}`,
      title: "Current location",
      subtitle: "Detected from GPS",
      coordinate,
    };

    if (!ORS_API_KEY) {
      return fallback;
    }

    try {
      const reverseUrl = buildUrl("reverse", {
        api_key: ORS_API_KEY,
        "point.lon": coordinate.longitude,
        "point.lat": coordinate.latitude,
        size: 1,
        "boundary.country": "LT",
      });

      const json = await fetchJson(reverseUrl);
      const feature = json?.features?.[0];

      if (!feature) {
        return fallback;
      }

      return featureToPlace(feature);
    } catch (error) {
      console.log("placeSearchService.reverseGeocode error:", error);
      return fallback;
    }
  },
};