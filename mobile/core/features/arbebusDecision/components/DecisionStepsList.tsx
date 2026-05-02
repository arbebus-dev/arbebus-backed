import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ArbebusDecisionStep } from "../types";

type Props = {
  steps: ArbebusDecisionStep[];
};

function getIcon(type: ArbebusDecisionStep["type"]) {
  switch (type) {
    case "walk_to_stop":
    case "walk_to_destination":
      return "🚶";
    case "wait_bus":
      return "⏱️";
    case "board_bus":
      return "🚍";
    case "ride_bus":
      return "🚌";
    case "transfer":
      return "🔁";
    case "exit_bus":
      return "📍";
    case "arrived":
      return "✅";
    default:
      return "•";
  }
}

export default function DecisionStepsList({ steps }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Kelionės eiga</Text>

      {steps.map((step, index) => (
        <View key={`${step.type}-${index}`} style={styles.row}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>{getIcon(step.type)}</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{step.title}</Text>
            {!!step.subtitle && <Text style={styles.subtitle}>{step.subtitle}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(8, 13, 26, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  heading: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
  },

  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },

  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    fontSize: 16,
  },

  content: {
    flex: 1,
  },

  title: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});