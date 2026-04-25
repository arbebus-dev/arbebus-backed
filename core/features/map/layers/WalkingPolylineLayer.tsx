import React from "react";
import { Polyline } from "react-native-maps";
import type { TransitStep } from "../../transit/models/transitRoute";

type Props = { step: TransitStep | null };

export default function WalkingPolylineLayer({ step }: Props) {
  if (!step || step.type !== "walk" || !step.polyline || step.polyline.length < 2) return null;
  return <Polyline coordinates={step.polyline} strokeWidth={4} strokeColor="#FFFFFF" lineDashPattern={[8, 8]} />;
}
