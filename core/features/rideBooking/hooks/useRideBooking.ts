import { useCallback, useMemo, useState } from "react";
import { placeSearchService } from "../../../services/places/placeSearchService";
import { routingService } from "../../../services/routing/routingService";
import type { Place } from "../models/place";
import type { PlaceSuggestion } from "../models/placeSuggestion";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RoutePoint = Coordinate;

type RideRoute = {
  polyline: RoutePoint[];
};

type RideDraft = {
  pickup: Place | null;
  destination: Place | null;
  route: RideRoute | null;
  selectedProductId: string | null;
};

type RideStatus =
  | "idle"
  | "searching"
  | "driver_assigned"
  | "driver_arriving"
  | "driver_arrived"
  | "ride_started"
  | "ride_completed";

type FlowState = "searching" | "loadingRoute" | "routePreview";

type MapPresentationState = {
  userCoordinate: Coordinate | null;
  pickupCoordinate: Coordinate | null;
  destinationCoordinate: Coordinate | null;
  driverCoordinate: Coordinate | null;
};

const DEFAULT_PRODUCTS = [
  { id: "smart" },
  { id: "taxi" },
  { id: "bus" },
  { id: "walk" },
];

function isValidCoordinate(value: any): value is Coordinate {
  return (
    value &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

function buildSimpleRoute(from: Coordinate, to: Coordinate): RoutePoint[] {
  const points = 24;

  return Array.from({ length: points + 1 }, (_, index) => {
    const t = index / points;

    return {
      latitude: from.latitude + (to.latitude - from.latitude) * t,
      longitude: from.longitude + (to.longitude - from.longitude) * t,
    };
  });
}

async function buildRealRouteOrFallback(
  from: Coordinate,
  to: Coordinate,
  profile: "driving-car" | "foot-walking" = "driving-car"
): Promise<RoutePoint[]> {
  try {
    const route = await routingService.getRoute(from, to, profile);

    if (Array.isArray(route?.polyline) && route.polyline.length > 1) {
      return route.polyline;
    }

    return buildSimpleRoute(from, to);
  } catch (error) {
    console.log("buildRealRouteOrFallback error:", error);
    return buildSimpleRoute(from, to);
  }
}

function formatPlaceLabel(place: Place | null, fallback = "") {
  if (!place) return fallback;
  return place.title || place.subtitle || fallback;
}

export function useRideBooking() {
  const [rideDraft, setRideDraft] = useState<RideDraft>({
    pickup: null,
    destination: null,
    route: null,
    selectedProductId: DEFAULT_PRODUCTS[0].id,
  });

  const [mapState, setMapState] = useState<MapPresentationState>({
    userCoordinate: null,
    pickupCoordinate: null,
    destinationCoordinate: null,
    driverCoordinate: null,
  });

  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [flowState, setFlowState] = useState<FlowState>("searching");

  const [activeField, setActiveField] = useState<"from" | "to" | null>(null);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<PlaceSuggestion[]>([]);

  const [driverHeading] = useState(0);
  const [driverRoutePoints] = useState<RoutePoint[]>([]);

  const etaBadgeText = useMemo(() => {
    const points = rideDraft.route?.polyline?.length ?? 0;
    if (!points) return null;

    return "Route ready";
  }, [rideDraft.route]);

  const routeSummaryText = useMemo(() => {
    const pickupLabel = formatPlaceLabel(rideDraft.pickup, "Current location");
    const destinationLabel = formatPlaceLabel(rideDraft.destination, "Choose destination");
    const polyline = rideDraft.route?.polyline ?? [];

    if (!rideDraft.destination) {
      return "Pasirink kelionės tikslą";
    }

    if (polyline.length >= 2) {
      return `${pickupLabel} → ${destinationLabel}`;
    }

    return "Maršrutas ruošiamas";
  }, [rideDraft.pickup, rideDraft.destination, rideDraft.route]);

  const pickupDisplayText = useMemo(() => {
    return formatPlaceLabel(rideDraft.pickup, "Current location");
  }, [rideDraft.pickup]);

  const destinationDisplayText = useMemo(() => {
    return formatPlaceLabel(rideDraft.destination, "Choose destination");
  }, [rideDraft.destination]);

  const isSearchExpanded = useMemo(() => {
    return activeField !== null;
  }, [activeField]);

  const initializeRideBooking = useCallback(() => {
    setRideStatus("idle");
    setFlowState("searching");
  }, []);

  const setExternalRoute = useCallback((route: { polyline: RoutePoint[] } | RoutePoint[]) => {
    const polyline = Array.isArray(route) ? route : route?.polyline ?? [];
    setRideDraft((prev) => ({
      ...prev,
      route: polyline.length ? { polyline } : null,
    }));
  }, []);

  const setSearchField = useCallback((field: "from" | "to" | null) => {
    setActiveField(field);
  }, []);

  const clearField = useCallback((field: "from" | "to") => {
    if (field === "from") {
      setFromQuery("");
      setRideDraft((prev) => ({
        ...prev,
        pickup: null,
        route: null,
      }));
      setMapState((prev) => ({
        ...prev,
        pickupCoordinate: null,
      }));
    } else {
      setToQuery("");
      setRideDraft((prev) => ({
        ...prev,
        destination: null,
        route: null,
      }));
      setMapState((prev) => ({
        ...prev,
        destinationCoordinate: null,
      }));
    }

    setSearchResults([]);
    setFlowState("searching");
    setRideStatus("idle");
  }, []);

  const updateQuery = useCallback(
    async (query: string) => {
      if (activeField === "from") {
        setFromQuery(query);
      } else if (activeField === "to") {
        setToQuery(query);
      }

      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);

      try {
        const results = await placeSearchService.autocomplete(query);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.log("updateQuery autocomplete error:", error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [activeField]
  );

  const resolveSuggestionToPlace = useCallback(
    async (suggestion: PlaceSuggestion): Promise<Place | null> => {
      if (isValidCoordinate((suggestion as any).coordinate)) {
        return {
          id: suggestion.id,
          title: suggestion.title,
          subtitle: suggestion.subtitle,
          coordinate: (suggestion as any).coordinate,
        };
      }

      try {
        const resolved = await placeSearchService.resolvePlace(
          String(suggestion.id ?? suggestion.title)
        );

        if (!resolved || !isValidCoordinate(resolved.coordinate)) {
          return null;
        }

        return {
          id: resolved.id,
          title: resolved.title,
          subtitle: resolved.subtitle,
          coordinate: resolved.coordinate,
        };
      } catch (error) {
        console.log("resolveSuggestionToPlace error:", error);
        return null;
      }
    },
    []
  );

  const selectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const resolvedPlace = await resolveSuggestionToPlace(suggestion);

      if (!resolvedPlace) {
        return;
      }

      setRecentSearches((prev) => {
        const next = [
          suggestion,
          ...prev.filter(
            (item) =>
              `${item.title}-${item.subtitle}` !==
              `${suggestion.title}-${suggestion.subtitle}`
          ),
        ];
        return next.slice(0, 8);
      });

      if (activeField === "from") {
        const currentDestination = rideDraft.destination;

        setFromQuery(resolvedPlace.title || resolvedPlace.subtitle || "");
        setMapState((prev) => ({
          ...prev,
          userCoordinate: resolvedPlace.coordinate,
          pickupCoordinate: resolvedPlace.coordinate,
        }));

        if (currentDestination) {
          setFlowState("loadingRoute");

          const route = await buildRealRouteOrFallback(
            resolvedPlace.coordinate,
            currentDestination.coordinate,
            "driving-car"
          );

          setRideDraft((prev) => ({
            ...prev,
            pickup: resolvedPlace,
            destination: currentDestination,
            route: {
              polyline: route,
            },
            selectedProductId: prev.selectedProductId ?? DEFAULT_PRODUCTS[0].id,
          }));

          setMapState((prev) => ({
            ...prev,
            userCoordinate: resolvedPlace.coordinate,
            pickupCoordinate: resolvedPlace.coordinate,
            destinationCoordinate: currentDestination.coordinate,
          }));

          setFlowState("routePreview");
          setRideStatus("idle");
        } else {
          setRideDraft((prev) => ({
            ...prev,
            pickup: resolvedPlace,
            route: null,
          }));
        }
      }

      if (activeField === "to") {
        const currentPickup =
          rideDraft.pickup ||
          (isValidCoordinate(mapState.userCoordinate)
            ? {
                id: "current-location",
                title: "Current location",
                subtitle: "Your location",
                coordinate: mapState.userCoordinate,
              }
            : null);

        setToQuery(resolvedPlace.title || resolvedPlace.subtitle || "");
        setMapState((prev) => ({
          ...prev,
          destinationCoordinate: resolvedPlace.coordinate,
        }));

        if (currentPickup) {
          setFlowState("loadingRoute");

          const route = await buildRealRouteOrFallback(
            currentPickup.coordinate,
            resolvedPlace.coordinate,
            "driving-car"
          );

          setRideDraft((prev) => ({
            ...prev,
            pickup: currentPickup,
            destination: resolvedPlace,
            route: {
              polyline: route,
            },
            selectedProductId: prev.selectedProductId ?? DEFAULT_PRODUCTS[0].id,
          }));

          setMapState((prev) => ({
            ...prev,
            pickupCoordinate: currentPickup.coordinate,
            destinationCoordinate: resolvedPlace.coordinate,
          }));

          setFlowState("routePreview");
          setRideStatus("idle");
        } else {
          setRideDraft((prev) => ({
            ...prev,
            destination: resolvedPlace,
            route: null,
          }));
        }
      }

      setSearchResults([]);
      setActiveField(null);
    },
    [
      activeField,
      mapState.userCoordinate,
      resolveSuggestionToPlace,
      rideDraft.destination,
      rideDraft.pickup,
    ]
  );


  const applyFavoriteRoute = useCallback(
    async ({ fromQueryValue, toQueryValue }: { fromQueryValue: string; toQueryValue: string }) => {
      try {
        const [fromResults, toResults] = await Promise.all([
          placeSearchService.autocomplete(fromQueryValue),
          placeSearchService.autocomplete(toQueryValue),
        ]);

        const fromFirst = Array.isArray(fromResults) ? fromResults[0] : null;
        const toFirst = Array.isArray(toResults) ? toResults[0] : null;
        if (!fromFirst || !toFirst) return;

        const fromPlace = await resolveSuggestionToPlace(fromFirst as any);
        const toPlace = await resolveSuggestionToPlace(toFirst as any);
        if (!fromPlace || !toPlace) return;

        const route = await buildRealRouteOrFallback(
          fromPlace.coordinate,
          toPlace.coordinate,
          "driving-car"
        );

        setFromQuery(fromPlace.title || fromPlace.subtitle || fromQueryValue);
        setToQuery(toPlace.title || toPlace.subtitle || toQueryValue);
        setRideDraft((prev) => ({
          ...prev,
          pickup: fromPlace,
          destination: toPlace,
          route: { polyline: route },
          selectedProductId: prev.selectedProductId ?? DEFAULT_PRODUCTS[0].id,
        }));
        setMapState((prev) => ({
          ...prev,
          userCoordinate: fromPlace.coordinate,
          pickupCoordinate: fromPlace.coordinate,
          destinationCoordinate: toPlace.coordinate,
        }));
        setSearchResults([]);
        setActiveField(null);
        setFlowState("routePreview");
        setRideStatus("idle");
      } catch (error) {
        console.log("applyFavoriteRoute error:", error);
      }
    },
    [resolveSuggestionToPlace]
  );

  const swapPlaces = useCallback(async () => {
    const nextPickup = rideDraft.destination;
    const nextDestination = rideDraft.pickup;

    let nextRoute: RideRoute | null = null;

    if (nextPickup && nextDestination) {
      const polyline = await buildRealRouteOrFallback(
        nextPickup.coordinate,
        nextDestination.coordinate,
        "driving-car"
      );

      nextRoute = {
        polyline,
      };
    }

    setMapState((currentMap) => ({
      ...currentMap,
      userCoordinate: nextPickup?.coordinate ?? currentMap.userCoordinate,
      pickupCoordinate: nextPickup?.coordinate ?? null,
      destinationCoordinate: nextDestination?.coordinate ?? null,
    }));

    setFromQuery(nextPickup?.title || nextPickup?.subtitle || "Current location");
    setToQuery(nextDestination?.title || nextDestination?.subtitle || "");

    if (nextPickup && nextDestination) {
      setFlowState("routePreview");
      setRideStatus("idle");
    } else {
      setFlowState("searching");
      setRideStatus("idle");
    }

    setRideDraft((prev) => ({
      ...prev,
      pickup: nextPickup,
      destination: nextDestination,
      route: nextRoute,
    }));
  }, [rideDraft.destination, rideDraft.pickup]);

  return {
    rideDraft,
    mapState,
    etaBadgeText,
    rideStatus,
    initializeRideBooking,
    setExternalRoute,
    driverHeading,
    driverRoutePoints,
    driverInfo: null,


    isSearchExpanded,
    searchResults,
    searchLoading,
    recentSearches,
    activeField,
    fromQuery,
    toQuery,
    setSearchField,
    updateQuery,
    selectSuggestion,
    clearField,
    swapPlaces,
    applyFavoriteRoute,

    pickupDisplayText,
    destinationDisplayText,
    routeSummaryText,
    flowState,
  };
}