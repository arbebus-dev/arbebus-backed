import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { createArbebusDecision } from "../createArbebusDecision";
import DecisionHeroCard from "./DecisionHeroCard";
import DecisionStepsList from "./DecisionStepsList";

type Props = {
  destinationName?: string;
  routeNumber?: string;
  stopName?: string;
  busArrivesInMinutes?: number;
  walkToStopMinutes?: number;
  delayMinutes?: number;
};

export default function ArbebusDecisionPanel(props: Props) {
  const decision = useMemo(
    () =>
      createArbebusDecision({
        destinationName: props.destinationName ?? "Akropolis",
        routeNumber: props.routeNumber ?? "6",
        stopName: props.stopName ?? "Bibliotekos st.",
        busArrivesInMinutes: props.busArrivesInMinutes ?? 8,
        walkToStopMinutes: props.walkToStopMinutes ?? 5,
        rideMinutes: 14,
        walkFromStopMinutes: 3,
        stopCount: 7,
        delayMinutes: props.delayMinutes ?? 0,
      }),
    [props]
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <DecisionHeroCard decision={decision} />
        <DecisionStepsList steps={decision.steps} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },

  content: {
    paddingTop: 12,
    paddingBottom: 32,
  },
});