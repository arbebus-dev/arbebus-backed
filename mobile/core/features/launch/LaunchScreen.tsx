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

import type { AppLanguage } from "@/core/i18n/translations";
import { translations } from "@/core/i18n/translations";

const BRAND = "#34F5B3";
const BG = "#03070B";
const SPLASH_IMAGE = require("../../../assets/splash.png");

type LaunchScreenProps = {
  onSelectLanguage: (language: AppLanguage) => void | Promise<void>;
};

export default function LaunchScreen({ onSelectLanguage }: LaunchScreenProps) {
  const screenFade = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1.025)).current;
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const controlsY = useRef(new Animated.Value(14)).current;
  const leaving = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const boot = async () => {
      await SplashScreen.hideAsync().catch(() => undefined);

      Animated.parallel([
        Animated.timing(screenFade, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(imageScale, {
          toValue: 1,
          duration: 1050,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 420,
          delay: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(controlsY, {
          toValue: 0,
          duration: 500,
          delay: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    };

    boot();
  }, [controlsOpacity, controlsY, imageScale, screenFade]);

  const chooseLanguage = async (language: AppLanguage) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );

    Animated.timing(leaving, {
      toValue: 0,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) void onSelectLanguage(language);
    });
  };

  return (
    <Animated.View style={[styles.root, { opacity: leaving }]}> 
      <Animated.View
        style={[
          styles.imageWrap,
          {
            opacity: screenFade,
            transform: [{ scale: imageScale }],
          },
        ]}
      >
        <ImageBackground
          source={SPLASH_IMAGE}
          style={styles.hero}
          resizeMode="cover"
        >
          <View pointerEvents="none" style={styles.bottomShade} />
        </ImageBackground>
      </Animated.View>

      <SafeAreaView pointerEvents="box-none" style={styles.safe}>
        <Animated.View
          style={[
            styles.languagePanel,
            { opacity: controlsOpacity, transform: [{ translateY: controlsY }] },
          ]}
        >
          <Text style={styles.chooseTitle}>Pasirink kalbą</Text>
          <Text style={styles.chooseSubtitle}>Choose language</Text>
          <View style={styles.languageRow}>
            <LanguageButton
              flag="🇱🇹"
              title={translations.lt.splash.lithuanian}
              code={translations.lt.splash.ltLabel}
              subtitle={translations.lt.splash.ltSubtitle}
              onPress={() => chooseLanguage("lt")}
            />
            <LanguageButton
              flag="🇬🇧"
              title={translations.en.splash.english}
              code={translations.en.splash.enLabel}
              subtitle={translations.en.splash.enSubtitle}
              onPress={() => chooseLanguage("en")}
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

function LanguageButton({
  flag,
  title,
  code,
  subtitle,
  onPress,
}: {
  flag: string;
  title: string;
  code: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <BlurView intensity={Platform.OS === "ios" ? 28 : 16} tint="dark" style={styles.languageShell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${code}`}
        onPress={onPress}
        style={({ pressed }) => [styles.languageButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.flag}>{flag}</Text>
        <Text style={styles.languageTitle}>{title}</Text>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{code}</Text>
        </View>
        <Text style={styles.languageSubtitle}>{subtitle}</Text>
      </Pressable>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    overflow: "hidden",
  },
  imageWrap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BG,
  },
  hero: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 230,
    backgroundColor: "rgba(3,7,11,0.22)",
  },
  safe: {
    ...StyleSheet.absoluteFill,
  },
  languagePanel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "66%",
    paddingHorizontal: 42,
    gap: 4,
  },
  chooseTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.60)",
    textShadowRadius: 10,
  },
  chooseSubtitle: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
    textAlign: "center",
    marginTop: -5,
    marginBottom: 0,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 8,
  },
  languageRow: {
    flexDirection: "row",
    gap: 10,
  },
  languageShell: {
    flex: 1,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  languageButton: {
    minHeight: 54,
    paddingVertical: 5,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,8,14,0.22)",
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.88,
  },
  flag: {
    fontSize: 13,
    marginBottom: 3,
  },
  languageTitle: {
    color: "white",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  codePill: {
    marginTop: 6,
    borderRadius: 999,
    minHeight: 24,
    minWidth: 48,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  codeText: {
    color: "#03140F",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },
  languageSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.74)",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
    textAlign: "center",
  },
});
