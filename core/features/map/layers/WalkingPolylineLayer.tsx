import React from "react";
import { Polyline } from "react-native-maps";
import type { Coordinate, TransitRouteOption } from "../../transit/models/transitTypes";

type Props = { route: TransitRouteOption | null; userLocation?: Coordinate | null };

export default function WalkingPolylineLayer({ route, userLocation }: Props) {
  if (!route || !userLocation) return null;
  const coords = [userLocation, { latitude: route.originStop.latitude, longitude: route.originStop.longitude }];
  return <Polyline coordinates={coords} strokeWidth={4} strokeColor="#4DA3FF" lineDashPattern={[8, 8]} />;
}
