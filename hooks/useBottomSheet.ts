import { useMemo, useRef } from "react";
import { Animated, PanResponder } from "react-native";

type UseBottomSheetParams = {
  sheetOpenY: number;
  sheetMidY: number;
  sheetClosedY: number;
  onSnapHaptic?: () => Promise<void> | void;
};

export function useBottomSheet({
  sheetOpenY,
  sheetMidY,
  sheetClosedY,
  onSnapHaptic,
}: UseBottomSheetParams) {
  const translateY = useRef(new Animated.Value(sheetClosedY)).current;
  const dragStartY = useRef(sheetClosedY);

  const snapPoints = [sheetOpenY, sheetMidY, sheetClosedY];

  const clampY = (value: number) => {
    return Math.max(sheetOpenY, Math.min(sheetClosedY, value));
  };

  const animateSheet = (toValue: number) => {
    dragStartY.current = toValue;

    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      damping: 24,
      stiffness: 220,
      mass: 0.9,
    }).start();
  };

  const snapToNearest = (value: number, velocityY: number) => {
    if (velocityY < -0.9) return sheetOpenY;
    if (velocityY > 0.9) return sheetClosedY;

    let closest = snapPoints[0];
    let minDistance = Math.abs(value - snapPoints[0]);

    for (let i = 1; i < snapPoints.length; i += 1) {
      const distance = Math.abs(value - snapPoints[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closest = snapPoints[i];
      }
    }

    return closest;
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),

        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),

        onPanResponderGrant: () => {
          translateY.stopAnimation((value: number) => {
            dragStartY.current = value;
          });
        },

        onPanResponderMove: (_, g) => {
          translateY.setValue(clampY(dragStartY.current + g.dy));
        },

        onPanResponderRelease: async (_, g) => {
          const current = clampY(dragStartY.current + g.dy);
          const snapPoint = snapToNearest(current, g.vy);

          if (onSnapHaptic) {
            await onSnapHaptic();
          }

          animateSheet(snapPoint);
        },

        onPanResponderTerminate: async (_, g) => {
          const current = clampY(dragStartY.current + g.dy);
          const snapPoint = snapToNearest(current, g.vy);

          if (onSnapHaptic) {
            await onSnapHaptic();
          }

          animateSheet(snapPoint);
        },
      }),
    [onSnapHaptic, sheetClosedY, sheetMidY, sheetOpenY, translateY]
  );

  return {
    translateY,
    dragStartY,
    animateSheet,
    snapToNearest,
    panResponder,
  };
}
