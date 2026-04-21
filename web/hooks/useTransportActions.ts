import { Alert, Linking, Platform } from "react-native";
import {
  AIRPORTS,
  SHEET_CLOSED_Y,
  SHEET_MID_Y,
  SHEET_OPEN_Y,
} from "../constants/home";
import { LiveBus, TravelMode } from "../types/home";

type CoordinateLike = {
  latitude: number;
  longitude: number;
};

type UseTransportActionsParams = {
  destination: string;
  pickupLabel?: string;
  destinationLabel?: string;
  pickupCoordinate?: CoordinateLike | null;
  destinationCoordinate?: CoordinateLike | null;
  eta: number | null;
  setDestination: (value: string) => void;
  setSelectedMode: (value: TravelMode) => void;
  setSelectedBus: (value: LiveBus | null) => void;
  setAiSuggestion: (value: any) => void;
  setEta: (value: number | null) => void;
  setSelectedRecommendationId: (value: string) => void;
  animateSheet: (toValue: number) => void;
  mediumHaptic: () => Promise<void>;
  tapHaptic: () => Promise<void>;
};

function hasCoords(value?: CoordinateLike | null) {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude)
  );
}

export function useTransportActions({
  destination,
  pickupLabel,
  destinationLabel,
  pickupCoordinate,
  destinationCoordinate,
  eta,
  setDestination,
  setSelectedMode,
  setSelectedBus,
  setAiSuggestion,
  setEta,
  setSelectedRecommendationId,
  animateSheet,
  mediumHaptic,
  tapHaptic,
}: UseTransportActionsParams) {
  const getPickup = () => pickupLabel?.trim() || "Current location";
  const getDestination = () =>
    destinationLabel?.trim() || destination?.trim() || "";

  const hasDestination = () => Boolean(getDestination().trim());

  const syncSelection = (
    mode: TravelMode,
    nextEta: number | null,
    recommendationId?: string
  ) => {
    setSelectedMode(mode);
    setAiSuggestion(mode);
    setEta(nextEta);
    setSelectedRecommendationId(recommendationId || mode);
  };

  const buildBoltDeepLink = () => {
    const pickup = encodeURIComponent(getPickup());
    const dropoff = encodeURIComponent(getDestination());

    if (hasCoords(pickupCoordinate) && hasCoords(destinationCoordinate)) {
      return `bolt://ride?pickup[latitude]=${pickupCoordinate!.latitude}&pickup[longitude]=${pickupCoordinate!.longitude}&pickup[address]=${pickup}&dropoff[latitude]=${destinationCoordinate!.latitude}&dropoff[longitude]=${destinationCoordinate!.longitude}&dropoff[address]=${dropoff}`;
    }

    return `bolt://?pickup=${pickup}&dropoff=${dropoff}`;
  };

  const buildBoltWebUrl = () => {
    const params = new URLSearchParams({
      pickup_address: getPickup(),
      dropoff_address: getDestination(),
    });

    if (hasCoords(pickupCoordinate)) {
      params.append("pickup_lat", String(pickupCoordinate!.latitude));
      params.append("pickup_lng", String(pickupCoordinate!.longitude));
    }

    if (hasCoords(destinationCoordinate)) {
      params.append("dropoff_lat", String(destinationCoordinate!.latitude));
      params.append("dropoff_lng", String(destinationCoordinate!.longitude));
    }

    return `https://m.bolt.eu/?${params.toString()}`;
  };

  const openBoltApp = async () => {
    try {
      const deepLink = buildBoltDeepLink();
      const supported = await Linking.canOpenURL(deepLink);

      if (supported) {
        await Linking.openURL(deepLink);
        return;
      }

      await Linking.openURL(buildBoltWebUrl());
    } catch {
      const storeUrl =
        Platform.OS === "ios"
          ? "https://apps.apple.com/app/bolt-request-a-ride/id675033630"
          : "https://play.google.com/store/apps/details?id=ee.mtakso.client";

      await Linking.openURL(storeUrl);
    }
  };

  const buildWalkingUrl = () => {
    if (Platform.OS === "ios") {
      if (hasCoords(pickupCoordinate) && hasCoords(destinationCoordinate)) {
        return `http://maps.apple.com/?saddr=${pickupCoordinate!.latitude},${pickupCoordinate!.longitude}&daddr=${destinationCoordinate!.latitude},${destinationCoordinate!.longitude}&dirflg=w`;
      }

      return `http://maps.apple.com/?q=${encodeURIComponent(getDestination())}`;
    }

    if (hasCoords(destinationCoordinate)) {
      return `google.navigation:q=${destinationCoordinate!.latitude},${destinationCoordinate!.longitude}&mode=w`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      getDestination()
    )}&travelmode=walking`;
  };

  const buildDrivingUrl = () => {
    if (Platform.OS === "ios") {
      if (hasCoords(pickupCoordinate) && hasCoords(destinationCoordinate)) {
        return `http://maps.apple.com/?saddr=${pickupCoordinate!.latitude},${pickupCoordinate!.longitude}&daddr=${destinationCoordinate!.latitude},${destinationCoordinate!.longitude}&dirflg=d`;
      }

      return `http://maps.apple.com/?q=${encodeURIComponent(getDestination())}`;
    }

    if (hasCoords(destinationCoordinate)) {
      return `google.navigation:q=${destinationCoordinate!.latitude},${destinationCoordinate!.longitude}&mode=d`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      getDestination()
    )}&travelmode=driving`;
  };

  const openMapUrl = async (url: string, fallbackUrl?: string) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
        return;
      }

      if (fallbackUrl) {
        await Linking.openURL(fallbackUrl);
        return;
      }

      await Linking.openURL(url);
    } catch {
      throw new Error("MAP_OPEN_FAILED");
    }
  };

  const openWalkingFlow = async () => {
    await mediumHaptic();

    if (!hasDestination()) {
      Alert.alert("Įvesk tikslą", "Pasirink kur nori eiti.");
      return;
    }

    syncSelection("walk", eta ?? 12, "walk");
    animateSheet(SHEET_OPEN_Y);

    try {
      const url = buildWalkingUrl();
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        getDestination()
      )}&travelmode=walking`;

      await openMapUrl(url, fallbackUrl);
    } catch {
      Alert.alert(
        "Nepavyko atidaryti žemėlapio",
        "Patikrink ar telefone įdiegta žemėlapių programėlė."
      );
    }
  };

  const openTaxiFlow = async () => {
    await mediumHaptic();

    if (!hasDestination()) {
      Alert.alert("Įvesk tikslą", "Pasirink kur važiuoji.");
      return;
    }

    syncSelection("taxi", eta ?? 7, "taxi");
    animateSheet(SHEET_CLOSED_Y);

    await openBoltApp();
  };

  const openBottomSheetForBus = async (bus: LiveBus) => {
    await mediumHaptic();

    setSelectedBus(bus);

    const nextEta =
      typeof bus.delaySeconds === "number" && bus.delaySeconds > 0
        ? Math.max(3, Math.round(bus.delaySeconds / 60) + 4)
        : eta ?? 8;

    syncSelection("bus", nextEta, "bus");
    animateSheet(SHEET_OPEN_Y);
  };

  const selectSmartMode = async () => {
    await tapHaptic();
    setSelectedBus(null);
    syncSelection("smart", eta, "smart");
    animateSheet(SHEET_MID_Y);
  };

  const selectTaxiMode = async () => {
    await tapHaptic();
    setSelectedBus(null);
    syncSelection("taxi", eta ?? 7, "taxi");
    animateSheet(SHEET_MID_Y);
  };

  const selectScooterMode = async () => {
    await tapHaptic();
    setSelectedBus(null);
    syncSelection("scooter", eta ?? 12, "scooter");
    animateSheet(SHEET_MID_Y);
  };

  const selectBusMode = async () => {
    await tapHaptic();
    syncSelection("bus", eta ?? 9, "bus");
    animateSheet(SHEET_MID_Y);
  };

  const selectTrainMode = async () => {
    await tapHaptic();
    setSelectedBus(null);
    syncSelection("train", eta ?? 18, "train");
    animateSheet(SHEET_MID_Y);
  };

  const selectAirportMode = async () => {
    await tapHaptic();
    setDestination(AIRPORTS.palanga);
    setSelectedBus(null);
    syncSelection("airport", eta ?? 32, "airport");
    animateSheet(SHEET_MID_Y);
  };

  const quickSelectAirport = async () => {
    await tapHaptic();
    setDestination(AIRPORTS.palanga);
  };

  const openBusFlow = async () => {
    await mediumHaptic();

    if (!hasDestination()) {
      Alert.alert("Įvesk tikslą", "Pasirink kur važiuoji autobusu.");
      return;
    }

    syncSelection("bus", eta ?? 9, "bus");
    animateSheet(SHEET_OPEN_Y);
  };

  const openTrainFlow = async () => {
    await mediumHaptic();

    if (!hasDestination()) {
      Alert.alert("Įvesk tikslą", "Pasirink kur važiuoji traukiniu.");
      return;
    }

    syncSelection("train", eta ?? 18, "train");
    animateSheet(SHEET_OPEN_Y);
  };

  const openAirportFlow = async () => {
    await mediumHaptic();

    setDestination(AIRPORTS.palanga);
    syncSelection("airport", eta ?? 32, "airport");
    animateSheet(SHEET_OPEN_Y);
  };

  const openScooterFlow = async () => {
    await mediumHaptic();

    if (!hasDestination()) {
      Alert.alert("Įvesk tikslą", "Pasirink kur važiuoji.");
      return;
    }

    syncSelection("scooter", eta ?? 12, "scooter");
    animateSheet(SHEET_OPEN_Y);

    try {
      const url = buildDrivingUrl();
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        getDestination()
      )}&travelmode=bicycling`;

      await openMapUrl(url, fallbackUrl);
    } catch {
      // paliekam tik app UI state
    }
  };

  const handleTransportResult = async (mode: string) => {
    if (mode === "taxi") {
      await openTaxiFlow();
      return;
    }

    if (mode === "walk") {
      await openWalkingFlow();
      return;
    }

    if (mode === "bus") {
      await openBusFlow();
      return;
    }

    if (mode === "train") {
      await openTrainFlow();
      return;
    }

    if (mode === "airport") {
      await openAirportFlow();
      return;
    }

    if (mode === "scooter") {
      await openScooterFlow();
      return;
    }

    await tapHaptic();
    Alert.alert("Transportas", "Pasirink galiojantį transporto variantą.");
  };

  return {
    openTaxiFlow,
    openBottomSheetForBus,
    selectSmartMode,
    selectTaxiMode,
    selectScooterMode,
    selectBusMode,
    selectTrainMode,
    selectAirportMode,
    quickSelectAirport,
    handleTransportResult,
  };
}
