import * as Haptics from "expo-haptics";
import { useMemo, useRef } from "react";
import { Animated, PanResponder } from "react-native";

export type BottomSheetSnapPoint = number;

function nearestSnap(value: number, points: readonly number[]) {
  return points.reduce(
    (best, point) =>
      Math.abs(point - value) < Math.abs(best - value) ? point : best,
    points[0] ?? 0,
  );
}

export function useBottomSheet({
  initialSnap,
  snapPoints,
  minSnap,
  maxSnap,
}: {
  initialSnap: number;
  snapPoints: readonly number[];
  minSnap: number;
  maxSnap: number;
}) {
  const translateY = useRef(new Animated.Value(initialSnap)).current;
  const currentY = useRef(initialSnap);
  const startY = useRef(initialSnap);

  const animateTo = (toValue: number) => {
    currentY.current = toValue;
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      damping: 30,
      stiffness: 235,
      mass: 0.82,
      restDisplacementThreshold: 0.6,
      restSpeedThreshold: 0.6,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dy) > 5 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.18,
        onPanResponderGrant: () => {
          startY.current = currentY.current;
          translateY.stopAnimation((value) => {
            currentY.current = value;
            startY.current = value;
          });
        },
        onPanResponderMove: (_evt, gesture) => {
          const next = Math.max(
            minSnap,
            Math.min(maxSnap, startY.current + gesture.dy),
          );
          currentY.current = next;
          translateY.setValue(next);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const snap = nearestSnap(
            currentY.current + gesture.vy * 145,
            snapPoints,
          );
          animateTo(snap);
          void Haptics.selectionAsync();
        },
        onPanResponderTerminate: () =>
          animateTo(nearestSnap(currentY.current, snapPoints)),
      }),
    [maxSnap, minSnap, snapPoints, translateY],
  );

  return {
    translateY,
    panHandlers: panResponder.panHandlers,
    animateTo,
    currentY,
  };
}
