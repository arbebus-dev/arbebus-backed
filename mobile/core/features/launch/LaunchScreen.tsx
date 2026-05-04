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
  const imageScale = useRef(new Animated.Value(1.035)).current;
  const imageY = useRef(new Animated.Value(8)).current;
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const controlsY = useRef(new Animated.Value(18)).current;
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
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(imageY, {
          toValue: 0,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 460,
          delay: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(controlsY, {
          toValue: 0,
          duration: 540,
          delay: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    };

    boot();
  }, [controlsOpacity, controlsY, imageScale, imageY, screenFade]);

  const chooseLanguage = async (language: AppLanguage) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );

    Animated.timing(leaving, {
      toValue: 0,
      duration: 220,
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

      <SafeAreaView pointerEvents="box-none" style={styles.safe}>
        <Animated.View
          style={[
            styles.languagePanel,
            { opacity: controlsOpacity, transform: [{ translateY: controlsY }] },
          ]}
        >
          <Text style={styles.chooseTitle}>Pasirink kalbą / Choose language</Text>
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
    <BlurView intensity={Platform.OS === "ios" ? 30 : 18} tint="dark" style={styles.languageShell}>
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
    backgroundColor: "rgba(3,7,11,0.06)",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: "rgba(3,7,11,0.34)",
  },
  safe: {
    ...StyleSheet.absoluteFillObject,
  },
  languagePanel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    paddingHorizontal: 22,
    gap: 12,
  },
  chooseTitle: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  languageRow: {
    flexDirection: "row",
    gap: 12,
  },
  languageShell: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.30)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  languageButton: {
    minHeight: 124,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,8,14,0.34)",
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.88,
  },
  flag: {
    fontSize: 28,
    marginBottom: 8,
  },
  languageTitle: {
    color: "white",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  codePill: {
    marginTop: 9,
    minWidth: 48,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  codeText: {
    color: "#06110D",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  languageSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
});
