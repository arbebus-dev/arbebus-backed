import { estimateWalkMinutes, getDistanceMeters } from "./geo";
import { findDirectRouteMatch } from "./routeMatcher";
import { getNearbyStops } from "./stopService";
import type {
  PlannerInput,
  TransitJourney,
  TransitJourneyLeg,
} from "./types";

function estimateBusMinutesBetweenStops(stopCount: number) {
  return Math.max(3, stopCount * 2);
}

export function buildTransitJourney(input: PlannerInput): TransitJourney | null {
  const {
    origin,
    destination,
    stops,
    maxOriginWalkMeters = 700,
    maxDestinationWalkMeters = 700,
    walkingSpeedMetersPerMinute = 80,
  } = input;

  if (!origin || !destination || !Array.isArray(stops) || stops.length === 0) {
    return null;
  }

  const nearbyOriginStops = getNearbyStops(
    origin,
    stops,
    maxOriginWalkMeters,
    6
  );

  const nearbyDestinationStops = getNearbyStops(
    destination,
    stops,
    maxDestinationWalkMeters,
    6
  );

  if (!nearbyOriginStops.length || !nearbyDestinationStops.length) {
    return null;
  }

  const directMatch = findDirectRouteMatch(
    nearbyOriginStops,
    nearbyDestinationStops
  );

  if (!directMatch) {
    return null;
  }

  const walkToStopDistance = getDistanceMeters(origin, {
    latitude: directMatch.originStop.latitude,
    longitude: directMatch.originStop.longitude,
  });

  const walkFromStopDistance = getDistanceMeters(destination, {
    latitude: directMatch.destinationStop.latitude,
    longitude: directMatch.destinationStop.longitude,
  });

  const walkToStopMinutes = estimateWalkMinutes(
    walkToStopDistance,
    walkingSpeedMetersPerMinute
  );

  const walkFromStopMinutes = estimateWalkMinutes(
    walkFromStopDistance,
    walkingSpeedMetersPerMinute
  );

  const pseudoStopCount = Math.max(
    2,
    Math.round(
      getDistanceMeters(
        {
          latitude: directMatch.originStop.latitude,
          longitude: directMatch.originStop.longitude,
        },
        {
          latitude: directMatch.destinationStop.latitude,
          longitude: directMatch.destinationStop.longitude,
        }
      ) / 900
    )
  );

  const busMinutes = estimateBusMinutesBetweenStops(pseudoStopCount);

  const legs: TransitJourneyLeg[] = [
    {
      type: "walk",
      fromLabel: "Dabartinė vieta",
      toLabel: directMatch.originStop.name,
      from: origin,
      to: {
        latitude: directMatch.originStop.latitude,
        longitude: directMatch.originStop.longitude,
      },
      distanceMeters: Math.round(walkToStopDistance),
      durationMinutes: walkToStopMinutes,
    },
    {
      type: "bus",
      routeId: directMatch.routeId,
      routeLabel: directMatch.routeId,
      fromStopId: directMatch.originStop.id,
      fromStopName: directMatch.originStop.name,
      toStopId: directMatch.destinationStop.id,
      toStopName: directMatch.destinationStop.name,
      stopCount: pseudoStopCount,
      durationMinutes: busMinutes,
      etaMinutes: null,
    },
    {
      type: "walk",
      fromLabel: directMatch.destinationStop.name,
      toLabel: "Tikslas",
      from: {
        latitude: directMatch.destinationStop.latitude,
        longitude: directMatch.destinationStop.longitude,
      },
      to: destination,
      distanceMeters: Math.round(walkFromStopDistance),
      durationMinutes: walkFromStopMinutes,
    },
  ];

  return {
    mode: "bus",
    summary: {
      totalDurationMinutes: walkToStopMinutes + busMinutes + walkFromStopMinutes,
      totalWalkMinutes: walkToStopMinutes + walkFromStopMinutes,
      totalBusMinutes: busMinutes,
      boardStopName: directMatch.originStop.name,
      alightStopName: directMatch.destinationStop.name,
      routeLabel: directMatch.routeId,
      etaMinutes: null,
    },
    legs,
  };
}