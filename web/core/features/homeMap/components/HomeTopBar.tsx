import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

type Props = {
  onMenuPress: () => void;
  onBrainPress: () => void;
};

function GlassCard({
  children,
  style,
  intensity = 35,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}) {
  return (
    <View style={[styles.glassCardWrap, style]}>
      <BlurView
        intensity={Platform.OS === "ios" ? intensity : 20}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassCardBorder} />
      <View style={styles.glassCardInner}>{children}</View>
    </View>
  );
}

function UltraPressable({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.88 }}>
      {children}
    </Pressable>
  );
}

export function HomeTopBar({ onMenuPress, onBrainPress }: Props) {
  return (
    <View style={styles.edgeHud}>
      <View style={styles.edgeHudTopRow}>
        <UltraPressable onPress={onMenuPress}>
          <GlassCard style={styles.cornerMenuButtonGlass}>
            <Ionicons name="menu" size={24} color="#F8FBFF" />
          </GlassCard>
        </UltraPressable>

        <View style={styles.centerWrap}>
          <View style={styles.aiStatusHud}>
            <View style={styles.aiHudGlow} />
            <View style={styles.aiStatusRow}>
              <View style={styles.aiStatusDot} />
              <Text style={styles.aiStatusLabel}>ARBEBUS AI</Text>
            </View>
          </View>
        </View>

        <UltraPressable onPress={onBrainPress}>
          <GlassCard style={styles.cornerAiButtonGlass}>
            <MaterialCommunityIcons name="brain" size={20} color="#8ED8FF" />
          </GlassCard>
        </UltraPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  edgeHud: {
    position: "absolute",
    top: 44,
    left: 16,
    right: 16,
    zIndex: 20,
    pointerEvents: "box-none",
  },

  edgeHudTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 52,
  },

  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  aiStatusHud: {
    width: "100%",
    maxWidth: 190,
    minHeight: 54,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: "rgba(7,18,38,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  aiHudGlow: {
    position: "absolute",
    top: -20,
    left: 18,
    width: 120,
    height: 60,
    borderRadius: 60,
    backgroundColor: "rgba(56,189,248,0.08)",
  },

  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  aiStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38BDF8",
    marginRight: 10,
    shadowColor: "#38BDF8",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  aiStatusLabel: {
    color: "#8ED8FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  glassCardWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(10,20,40,0.25)",
  },

  glassCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  glassCardInner: {
    position: "relative",
  },

  cornerMenuButtonGlass: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  cornerAiButtonGlass: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7, 18, 38, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(142,216,255,0.18)",
    overflow: "hidden",
  },
});