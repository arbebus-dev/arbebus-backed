import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ArbebusDecision } from "../types";

type Props = {
  decision: ArbebusDecision;
  onPrimaryPress?: () => void;
};

export default function DecisionHeroCard({ decision, onPrimaryPress }: Props) {
  return (
    <View style={[styles.card, styles[decision.urgency]]}>
      <Text style={styles.kicker}>ARBEBUS SMART DECISION</Text>

      <Text style={styles.title}>{decision.title}</Text>

      <Text style={styles.subtitle}>{decision.subtitle}</Text>

      {!!decision.secondaryText && (
        <Text style={styles.secondary}>{decision.secondaryText}</Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaLabel}>Autobusas</Text>
          <Text style={styles.metaValue}>{decision.busRoute ?? "—"}</Text>
        </View>

        <View style={styles.metaPill}>
          <Text style={styles.metaLabel}>Tikslumas</Text>
          <Text style={styles.metaValue}>
            {Math.round(decision.confidence * 100)}%
          </Text>
        </View>
      </View>

      <Pressable style={styles.button} onPress={onPrimaryPress}>
        <Text style={styles.buttonText}>{decision.primaryAction}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 28,
    backgroundColor: "rgba(8, 13, 26, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  calm: {
    shadowColor: "#4ade80",
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },

  soon: {
    shadowColor: "#facc15",
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },

  now: {
    shadowColor: "#38bdf8",
    shadowOpacity: 0.35,
    shadowRadius: 22,
  },

  late: {
    shadowColor: "#fb7185",
    shadowOpacity: 0.3,
    shadowRadius: 18,
  },

  kicker: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  subtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },

  secondary: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: 8,
  },

  metaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  metaPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  metaLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
  },

  metaValue: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },

  button: {
    marginTop: 18,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  buttonText: {
    color: "#050816",
    fontSize: 16,
    fontWeight: "900",
  },
});