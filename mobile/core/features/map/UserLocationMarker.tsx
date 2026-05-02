import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type Props = {
  heading?: number; // 0-360
  size?: number;
};

export default function UserLocationMarker({
  heading = 0,
  size = 44,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.82,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    glowLoop.start();

    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [glow, pulse]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 2.2],
  });

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0],
  });

  const markerSize = size;
  const outerSize = markerSize;
  const innerSize = markerSize * 0.76;
  const coreSize = markerSize * 0.28;
  const arrowSize = markerSize * 0.34;

  const arrowTransform = useMemo(
    () => [{ rotate: `${heading}deg` }],
    [heading]
  );

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.pulse,
          {
            width: markerSize,
            height: markerSize,
            borderRadius: markerSize / 2,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.markerShadow,
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            transform: [{ scale: glow }],
          },
        ]}
      >
        <View
          style={[
            styles.outerRing,
            {
              width: outerSize,
              height: outerSize,
              borderRadius: outerSize / 2,
            },
          ]}
        >
          <View
            style={[
              styles.innerRing,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
              },
            ]}
          >
            <View
              style={[
                styles.core,
                {
                  width: coreSize,
                  height: coreSize,
                  borderRadius: coreSize / 2,
                },
              ]}
            />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.headingWrap,
          {
            width: markerSize * 1.8,
            height: markerSize * 1.8,
            borderRadius: markerSize,
          },
          { transform: arrowTransform },
        ]}
      >
        <View
          style={[
            styles.headingArrow,
            {
              top: markerSize * 0.02,
              borderLeftWidth: arrowSize * 0.32,
              borderRightWidth: arrowSize * 0.32,
              borderBottomWidth: arrowSize,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    backgroundColor: "rgba(36, 196, 255, 0.22)",
  },
  markerShadow: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#24c4ff",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  outerRing: {
    backgroundColor: "#1f8fff",
    borderWidth: 3,
    borderColor: "#dff7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  innerRing: {
    backgroundColor: "#0a1f4f",
    borderWidth: 2,
    borderColor: "rgba(110,220,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  core: {
    backgroundColor: "#52d6ff",
    borderWidth: 4,
    borderColor: "#f4fbff",
  },
  headingWrap: {
    position: "absolute",
    alignItems: "center",
  },
  headingArrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(84, 220, 255, 0.42)",
  },
});