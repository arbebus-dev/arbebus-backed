import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BRAND = "#34F5B3";
const BG = "#03070B";

const SPLASH_IMAGE = require("../../../assets/splash.png");

type LaunchScreenProps = {
  onStart: () => void;
};

export default function LaunchScreen({ onStart }: LaunchScreenProps) {
  const screenFade = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1.045)).current;
  const imageY = useRef(new Animated.Value(10)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(22)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const leaving = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const boot = async () => {
      await SplashScreen.hideAsync().catch(() => undefined);

      Animated.parallel([
        Animated.timing(screenFade, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(imageScale, {
          toValue: 1,
          duration: 1250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(imageY, {
          toValue: 0,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 480,
          delay: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonY, {
          toValue: 0,
          duration: 560,
          delay: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1450,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 1450,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    boot();
  }, [buttonOpacity, buttonY, imageScale, imageY, pulse, screenFade]);

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );

    Animated.timing(leaving, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onStart();
    });
  };

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.62],
  });

  return (
    <Animated.View style={[styles.root, { opacity: leaving }]}> 
      <Animated.View
        style={[
          styles.imageWrap,
          {
            opacity: screenFade,
            transform: [{ scale: imageScale }, { translateY: imageY }],
          },
        ]}
      >
        <ImageBackground
          source={SPLASH_IMAGE}
          style={styles.hero}
          resizeMode="cover"
        >
          <View pointerEvents="none" style={styles.topShade} />
          <View pointerEvents="none" style={styles.bottomShade} />
        </ImageBackground>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.buttonGlow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.safe}>
        <Animated.View
          style={[
            styles.bottom,
            { opacity: buttonOpacity, transform: [{ translateY: buttonY }] },
          ]}
        >
          <BlurView intensity={Platform.OS === "ios" ? 32 : 18} tint="dark" style={styles.buttonShell}>
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
          </BlurView>

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
    overflow: "hidden",
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  hero: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "rgba(3,7,11,0.10)",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: "rgba(3,7,11,0.46)",
  },
  safe: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 34,
    alignItems: "center",
  },
  buttonGlow: {
    position: "absolute",
    left: 34,
    right: 34,
    bottom: 64,
    height: 68,
    borderRadius: 34,
    backgroundColor: BRAND,
    shadowColor: BRAND,
    shadowOpacity: 0.62,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
  },
  buttonShell: {
    width: "100%",
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  button: {
    width: "100%",
    minHeight: 64,
    borderRadius: 34,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.93,
  },
  buttonText: {
    color: "#02130D",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.15,
  },
  note: {
    marginTop: 15,
    color: "rgba(226,232,240,0.62)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
