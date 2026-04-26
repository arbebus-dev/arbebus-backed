import React, { useMemo } from "react";
import { Polyline } from "react-native-maps";
import type { TransitRouteOption } from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
};

export default function RoutePolylineLayer({ route }: Props) {
  const points = useMemo(() => {
    if (!route) return [];

    // 1️⃣ prioritetas – previewPoints (backend)
    if (Array.isArray(route.previewPoints) && route.previewPoints.length >= 2) {
      return route.previewPoints.filter(
        (p) =>
          p &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      );
    }

    // 2️⃣ fallback – polyline
    if (Array.isArray(route.polyline) && route.polyline.length >= 2) {
      return route.polyline.filter(
        (p) =>
          p &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      );
    }

    return [];
  }, [route]);

  // 🔴 jei čia 0 – reiškia problema NE šiame faile
  if (points.length < 2) return null;

  return (
    <>
      {/* glow */}
      <Polyline
        coordinates={points}
        strokeWidth={10}
        strokeColor="rgba(53,242,180,0.25)"
      />

      {/* main line */}
      <Polyline
        coordinates={points}
        strokeWidth={5}
        strokeColor="#35F2B4"
      />
    </>
  );
}