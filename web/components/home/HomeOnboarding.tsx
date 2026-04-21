import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "../../styles";
import UltraPressable from "../ui/UltraPressable";

type MdiIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type OnboardingSlide = {
  title: string;
  subtitle: string;
  icon: MdiIconName;
};

type Props = {
  currentSlide: OnboardingSlide;
  onboardingSlides: OnboardingSlide[];
  onboardingStep: number;
  onNext: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
};

export default function HomeOnboarding({
  currentSlide,
  onboardingSlides,
  onboardingStep,
  onNext,
  onSkip,
}: Props) {
  return (
    <SafeAreaView style={styles.onboardingScreen}>
      <View style={styles.onboardingCard}>
        <View style={styles.onboardingCardGlow} />

        <View style={styles.onboardingIconWrap}>
          <MaterialCommunityIcons
            name={currentSlide.icon}
            size={44}
            color="#38bdf8"
          />
        </View>

        <Text style={styles.onboardingTitle}>{currentSlide.title}</Text>
        <Text style={styles.onboardingSubtitle}>{currentSlide.subtitle}</Text>

        <View style={styles.onboardingDots}>
          {onboardingSlides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.onboardingDot,
                onboardingStep === index && styles.onboardingDotActive,
              ]}
            />
          ))}
        </View>

        <UltraPressable onPress={onNext}>
          <View style={styles.onboardingPrimaryBtn}>
            <Text style={styles.onboardingPrimaryText}>
              {onboardingStep < onboardingSlides.length - 1
                ? "Toliau"
                : "Pradėti"}
            </Text>
          </View>
        </UltraPressable>

        <Pressable onPress={onSkip}>
          <Text style={styles.onboardingSkip}>Praleisti</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}