import { useEffect } from "react";
import { Animated, Easing } from "react-native";

type UseUiAnimationsParams = {
  selectedMode: string;
  selectedRecommendationId: string;
  driverInfo: any;
  rideStatus: string;
  smartCardOpacity: Animated.Value;
  smartCardTranslateY: Animated.Value;
  driverCardOpacity: Animated.Value;
  driverCardTranslateY: Animated.Value;
  ctaPulse: Animated.Value;
  aiHudFloat: Animated.Value;
};

export function useUiAnimations({
  selectedMode,
  selectedRecommendationId,
  driverInfo,
  rideStatus,
  smartCardOpacity,
  smartCardTranslateY,
  driverCardOpacity,
  driverCardTranslateY,
  ctaPulse,
  aiHudFloat,
}: UseUiAnimationsParams) {
  useEffect(() => {
    Animated.parallel([
      Animated.timing(smartCardOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(smartCardTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.85,
      }),
    ]).start();
  }, [
    selectedMode,
    selectedRecommendationId,
    smartCardOpacity,
    smartCardTranslateY,
  ]);

  useEffect(() => {
    const visible =
      !!driverInfo &&
      ["driver_assigned", "driver_arriving", "driver_arrived", "ride_started"].includes(
        rideStatus
      );

    if (visible) {
      Animated.parallel([
        Animated.timing(driverCardOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(driverCardTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
          mass: 0.85,
        }),
      ]).start();
    } else {
      driverCardOpacity.setValue(0);
      driverCardTranslateY.setValue(24);
    }
  }, [driverInfo, rideStatus, driverCardOpacity, driverCardTranslateY]);

  useEffect(() => {
    const shouldPulse =
      rideStatus === "driver_arrived" ||
      rideStatus === "driver_assigned" ||
      rideStatus === "driver_arriving";

    if (!shouldPulse) {
      ctaPulse.stopAnimation();
      ctaPulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1.018,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      ctaPulse.setValue(1);
    };
  }, [rideStatus, ctaPulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(aiHudFloat, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(aiHudFloat, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [aiHudFloat]);
}