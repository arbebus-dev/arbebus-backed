import React from "react";
import { Polyline } from "react-native-maps";
import type { TransitRouteOption } from "../../transit/models/transitRoute";

type Props = { route: TransitRouteOption | null };

export default function RoutePolylineLayer({ route }: Props) {
  if (!route || route.polyline.length < 2) return null;
  return (
    <>
      <Polyline coordinates={route.polyline} strokeWidth={9} strokeColor="rgba(105,225,255,0.22)" />
      <Polyline coordinates={route.polyline} strokeWidth={5} strokeColor="#69E1FF" />
    </>
  );
}
