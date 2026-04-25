import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransitFlowState } from "../transit/models/transitFlowState";
import type { TransitRouteOption, TransitStep, TransitStop } from "../transit/models/transitRoute";
import RouteOptionCard from "./RouteOptionCard";
import StepInstructionCard from "./StepInstructionCard";

type Props = {
  flowState: TransitFlowState;
  isPlanning: boolean;
  error: string | null;
  selectedDestination: TransitStop | null;
  selectedRoute: TransitRouteOption | null;
  routes: TransitRouteOption[];
  selectedRouteId: string | null;
  activeStep: TransitStep | null;
  liveBusCount: number;
  onSelectRoute: (routeId: string) => void;
  onStartRoute: () => void;
  onNextStep: () => void;
  onClear: () => void;
};

function titleForState(flowState: TransitFlowState, activeStep: TransitStep | null) {
  switch (flowState) {
    case "idle": return "Įvesk tikslą";
    case "searching": return "Ieškome vietų";
    case "destination_selected": return "Tikslas pasirinktas";
    case "routes_loading": return "Ieškome geriausio autobuso";
    case "route_options": return "Pasirink maršrutą";
    case "route_selected": return "Maršrutas paruoštas";
    case "walking_to_stop": return "Eik iki stotelės";
    case "waiting_bus": return activeStep?.routeNumber ? `Lauk autobuso Nr. ${activeStep.routeNumber}` : "Lauk autobuso";
    case "onboard": return activeStep?.stopCount ? `Važiuok ${activeStep.stopCount} stotelių` : "Važiuok autobusu";
    case "transfer": return activeStep?.routeNumber ? `Persėsk į autobusą Nr. ${activeStep.routeNumber}` : "Persėsk į kitą autobusą";
    case "arriving": return "Išlipk kitoje stotelėje";
    case "completed": return "Atvykai";
    default: return "Arbebus";
  }
}

function descriptionForState(flowState: TransitFlowState, destination: TransitStop | null) {
  switch (flowState) {
    case "idle": return "Įvesk tikslą viršuje. Arbebus parodys stoteles, autobusų variantus, persėdimus ir aiškų GO veiksmą.";
    case "searching": return "Renkame stoteles ir vietas Klaipėdoje.";
    case "destination_selected": return destination ? `Tikslas: ${destination.title}. Ruošiame autobusų variantus.` : "Ruošiame autobusų variantus.";
    case "routes_loading": return "Tikriname stoteles, persėdimus, ETA ir autobusų numerius.";
    case "route_options": return "Pasirink tinkamiausią variantą pagal laiką, ėjimą ir persėdimus.";
    case "route_selected": return "Spausk GO ir pradėk kelionės instrukcijas kaip Apple Maps.";
    case "walking_to_stop": return "Sek liniją žemėlapyje iki nurodytos stotelės.";
    case "waiting_bus": return "Lik stotelėje ir stebėk atvykstantį autobusą žemėlapyje.";
    case "onboard": return "Važiuok autobusu. Arbebus rodys kada ruoštis išlipti.";
    case "transfer": return "Išlipk ir eik prie kitos stotelės / platformos.";
    case "arriving": return "Ruoškis išlipti ir eik iki galutinio tikslo.";
    case "completed": return "Kelionė baigta.";
    default: return "";
  }
}

export default function JourneySheet({
  flowState,
  isPlanning,
  error,
  selectedDestination,
  selectedRoute,
  routes,
  selectedRouteId,
  activeStep,
  liveBusCount,
  onSelectRoute,
  onStartRoute,
  onNextStep,
  onClear,
}: Props) {
  const showRouteOptions = flowState === "route_options" || flowState === "route_selected";
  const showActiveStep = ["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(flowState) && activeStep;
  const showGo = flowState === "route_selected" && selectedRoute;
  const showNext = showActiveStep;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{titleForState(flowState, activeStep)}</Text>
          <Text style={styles.subtitle}>{descriptionForState(flowState, selectedDestination)}</Text>
          <Text style={styles.meta}>Live autobusai: {liveBusCount} · State: {flowState}</Text>
        </View>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="bus-clock" color="#69E1FF" size={23} />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isPlanning || flowState === "routes_loading" ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#69E1FF" />
          <Text style={styles.loadingText}>Ieškome geriausio autobuso...</Text>
        </View>
      ) : null}

      {showRouteOptions ? (
        <ScrollView style={styles.routesList} showsVerticalScrollIndicator={false}>
          {routes.map((route) => (
            <RouteOptionCard
              key={route.id}
              route={route}
              selected={route.id === selectedRouteId}
              onPress={() => onSelectRoute(route.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {showActiveStep && activeStep ? <StepInstructionCard step={activeStep} /> : null}

      {showGo ? (
        <Pressable style={styles.primaryButton} onPress={onStartRoute}>
          <Text style={styles.primaryButtonText}>GO</Text>
        </Pressable>
      ) : null}

      {showNext ? (
        <Pressable style={styles.primaryButton} onPress={onNextStep}>
          <Text style={styles.primaryButtonText}>TOLIAU</Text>
        </Pressable>
      ) : null}

      {flowState === "completed" ? (
        <Pressable style={styles.primaryButton} onPress={onClear}>
          <Text style={styles.primaryButtonText}>NAUJA KELIONĖ</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 92,
    maxHeight: "50%",
    borderRadius: 28,
    backgroundColor: "rgba(6, 10, 20, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 24,
  },
  handle: { width: 42, height: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.22)", alignSelf: "center", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  subtitle: { color: "#CDD4EA", fontSize: 14, lineHeight: 20, marginTop: 5 },
  meta: { color: "#8E96B2", fontSize: 12, fontWeight: "800", marginTop: 7 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(105,225,255,0.14)", alignItems: "center", justifyContent: "center" },
  error: { color: "#FF8B8B", fontWeight: "800", marginTop: 10 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  loadingText: { color: "#CDD4EA", fontWeight: "800" },
  routesList: { marginTop: 12, maxHeight: 230 },
  primaryButton: { marginTop: 14, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#69E1FF" },
  primaryButtonText: { color: "#06101C", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});
