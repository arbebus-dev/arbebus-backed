import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { T, LINE_HEIGHT, COLORS } from "@/core/theme/typography";

type Props = { step?: { title?: string; subtitle?: string; meta?: string } | null };

export default function ActiveStepCard({ step }: Props) {
  if (!step) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>{step.title}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>{step.subtitle}</Text>
      {step.meta ? <Text style={styles.meta} numberOfLines={1}>{step.meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", bottom: 20, left: 16, right: 16, backgroundColor: "rgba(7,12,24,0.92)", borderRadius: 18, padding: 13, borderWidth: 1, borderColor: COLORS.line },
  title: { fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900", color: COLORS.text },
  subtitle: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, color: COLORS.muted, marginTop: 2, fontWeight: "700" },
  meta: { fontSize: T.badge, lineHeight: LINE_HEIGHT.badge, color: COLORS.dim, marginTop: 4, fontWeight: "700" },
});
