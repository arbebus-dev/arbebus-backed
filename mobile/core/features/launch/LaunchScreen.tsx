import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BRAND = "#34F5B3";
const BG = "#05070D";

type LaunchScreenProps = {
  onStart: () => void;
};

export default function LaunchScreen({ onStart }: LaunchScreenProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const buttonY = useRef(new Animated.Value(18)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const leaving = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const boot = async () => {
      // Expo native splash stays visible until this custom launch screen is mounted.
      await SplashScreen.hideAsync().catch(() => undefined);

      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(buttonY, {
          toValue: 0,
          duration: 560,
          delay: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    boot();
  }, [buttonY, fade, glow, logoScale]);

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );

    Animated.timing(leaving, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onStart();
    });
  };

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.62],
  });

  return (
    <Animated.View style={[styles.root, { opacity: leaving }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.brandTop}>
          <Text style={styles.kicker}>ARBE NAVIGATION</Text>
          <Text style={styles.title}>Arbebus</Text>
          <Text style={styles.subtitle}>AI transit, live buses, smart routes</Text>
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { opacity: glowOpacity }]}
        />

        <Animated.View
          style={[
            styles.logoWrap,
            { opacity: fade, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image
            source={require("../../../assets/splash.png")}
            style={styles.splashImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.bottom,
            { opacity: fade, transform: [{ translateY: buttonY }] },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Arbebus"
            onPress={handleStart}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Arbebus AI Go</Text>
          </Pressable>

          <Text style={styles.note}>Klaipėda transit preview • TestFlight</Text>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandTop: {
    position: "absolute",
    top: 42,
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 3,
  },
  kicker: {
    color: BRAND,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 5,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 10,
    color: "#F8FAFC",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(226,232,240,0.72)",
    fontSize: 14,
    fontWeight: "600",
  },
  glow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(52,245,179,0.28)",
    shadowColor: BRAND,
    shadowOpacity: 0.85,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  logoWrap: {
    width: "86%",
    maxWidth: 360,
    height: 330,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  splashImage: {
    width: "100%",
    height: "100%",
  },
  bottom: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 46,
    alignItems: "center",
    zIndex: 4,
  },
  button: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: BRAND,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  buttonText: {
    color: "#03120D",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  note: {
    marginTop: 14,
    color: "rgba(226,232,240,0.54)",
    fontSize: 12,
    fontWeight: "600",
  },
});
