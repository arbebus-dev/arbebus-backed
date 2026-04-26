import React, { useMemo } from "react";
import { Polyline } from "react-native-maps";
import type { TransitRouteOption } from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
};

function isValidPoint(point: any) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

export default function RoutePolylineLayer({ route }: Props) {
  const points = useMemo(() => {
    if (!route) return [];

    const polyline = Array.isArray(route.polyline)
      ? route.polyline.filter(isValidPoint)
      : [];

    if (polyline.length >= 2) return polyline;

    const previewPoints = Array.isArray(route.previewPoints)
      ? route.previewPoints.filter(isValidPoint)
      : [];

    if (previewPoints.length >= 2) return previewPoints;

    return [];
  }, [route]);

  if (points.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={points}
        strokeWidth={11}
        strokeColor="rgba(53,242,180,0.20)"
        lineCap="round"
        lineJoin="round"
      />

      <Polyline
        coordinates={points}
        strokeWidth={6}
        strokeColor="#35F2B4"
        lineCap="round"
        lineJoin="round"
      />
    </>
  );
}