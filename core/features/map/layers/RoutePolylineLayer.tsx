import React from "react";
import { Polyline } from "react-native-maps";
import type { TransitRouteOption } from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
};

export default function RoutePolylineLayer({ route }: Props) {
  const points = route?.previewPoints?.length ? route.previewPoints : route?.polyline ?? [];

  if (!route || points.length < 2) return null;

  return (
    <>
      <Polyline coordinates={points} strokeWidth={8} strokeColor="rgba(53,242,180,0.25)" />
      <Polyline coordinates={points} strokeWidth={5} strokeColor="#35F2B4" />
    </>
  );
}
