import React from "react";
import { Polyline } from "react-native-maps";
import type {
  Coordinate,
  TransitRouteOption,
} from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
  userLocation?: Coordinate | null;
};

function valid(point?: Coordinate | null) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

export default function WalkingPolylineLayer({ route, userLocation }: Props) {
  if (!route || !valid(userLocation)) return null;

  const boardStop = route.originStop?.coordinate ?? {
    latitude: route.originStop.latitude,
    longitude: route.originStop.longitude,
  };

  const destinationStop = route.destinationStop?.coordinate ?? {
    latitude: route.destinationStop.latitude,
    longitude: route.destinationStop.longitude,
  };

  const destination =
    Array.isArray(route.previewPoints) && route.previewPoints.length >= 2
      ? route.previewPoints[route.previewPoints.length - 1]
      : null;

  const accessWalk =
    valid(boardStop) && valid(userLocation)
      ? [userLocation as Coordinate, boardStop]
      : [];

  const egressWalk =
    valid(destinationStop) && valid(destination)
      ? [destinationStop, destination as Coordinate]
      : [];

  return (
    <>
      {accessWalk.length >= 2 ? (
        <Polyline
          coordinates={accessWalk}
          strokeWidth={5}
          strokeColor="#4DA3FF"
          lineDashPattern={[10, 8]}
          lineCap="round"
          lineJoin="round"
        />
      ) : null}

      {egressWalk.length >= 2 ? (
        <Polyline
          coordinates={egressWalk}
          strokeWidth={5}
          strokeColor="#FFB84D"
          lineDashPattern={[10, 8]}
          lineCap="round"
          lineJoin="round"
        />
      ) : null}
    </>
  );
}