import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { T, LINE_HEIGHT, COLORS, UI } from "@/core/theme/typography";

type Props = {
  step?: { title?: string; subtitle?: string; actionLabel?: string } | null;
  progress?: string;
  onAction?: () => void;
};

export default function NavigationCard({ step, progress, onAction }: Props) {
  if (!step) return null;
  return (
    <View style={styles.container}>
      <View style={styles.progress}><Text style={styles.progressText}>{progress || ""}</Text></View>
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>{step.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{step.subtitle}</Text>
      </View>
      <Pressable style={styles.cta} onPress={onAction}><Text style={styles.ctaText}>{step.actionLabel || "Toliau"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", top: 60, left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: UI.gapM, backgroundColor: "rgba(7,12,24,0.92)", borderRadius: 18, padding: 11, borderWidth: 1, borderColor: COLORS.line },
  progress: { minWidth: 36, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.soft, paddingHorizontal: 8 },
  progressText: { color: COLORS.text, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  center: { flex: 1 },
  title: { fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900", color: COLORS.text },
  subtitle: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, color: COLORS.muted, marginTop: 1, fontWeight: "700" },
  cta: { backgroundColor: COLORS.green, paddingHorizontal: 12, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900", color: COLORS.greenDark },
});
