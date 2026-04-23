import { Alert, Linking, Platform } from "react-native";
import { SHEET_CLOSED_Y, SHEET_OPEN_Y } from "../constants/home";

type JourneyStepLike = {
  title?: string | null;
  subtitle?: string | null;
  kind?: string | null;
  targetCoordinate?: CoordinateLike | null;
};

type CoordinateLike = {
  latitude: number;
  longitude: number;
};

type RecommendationLike = {
  mode?: string | null;
  journeySteps?: JourneyStepLike[] | null;
};

type UsePrimaryActionParams = {
  selectedMode: string;
  isPro: boolean;
  getFinalMode: () => any;
  mediumHaptic: () => Promise<void>;
  runSmartRoute: () => Promise<void>;
  animateSheet: (toValue: number) => void;
  handleOpenProPaywall: (
    source: "smart_route" | "leave_alert" | "delay_alert" | "cta"
  ) => Promise<void>;
  handleTransportResult: (finalMode: string) => Promise<void>;
  selectedRecommendation?: RecommendationLike | null;
  pickupCoordinate?: CoordinateLike | null;
  destinationCoordinate?: CoordinateLike | null;
  routeCoords?: CoordinateLike[];
  currentStep?: JourneyStepLike | null;
  dynamicPrimaryLabel?: string | null;
  dynamicPrimaryIcon?: string | null;
};

function buildAppleWalkingUrl(start?: CoordinateLike | null, end?: CoordinateLike | null) {
  if (start && end) {
    return `http://maps.apple.com/?saddr=${start.latitude},${start.longitude}&daddr=${end.latitude},${end.longitude}&dirflg=w`;
  }

  if (end) {
    return `http://maps.apple.com/?daddr=${end.latitude},${end.longitude}&dirflg=w`;
  }

  return null;
}

function buildGoogleWalkingUrl(start?: CoordinateLike | null, end?: CoordinateLike | null) {
  if (!end) return null;
  const origin = start ? `&origin=${start.latitude},${start.longitude}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${end.latitude},${end.longitude}&travelmode=walking`;
}

function buildWalkingUrl(start?: CoordinateLike | null, end?: CoordinateLike | null) {
  if (Platform.OS === "ios") {
    return buildAppleWalkingUrl(start, end) || buildGoogleWalkingUrl(start, end);
  }

  if (end) {
    return `google.navigation:q=${end.latitude},${end.longitude}&mode=w`;
  }

  return buildGoogleWalkingUrl(start, end);
}

function hasWalkingLikeStep(step?: JourneyStepLike | null) {
  const text = `${step?.title || ""} ${step?.subtitle || ""}`.toLowerCase();
  return text.includes("eik") || text.includes("walk") || text.includes("pės") || text.includes("stotel");
}

function hasBoardLikeStep(step?: JourneyStepLike | null) {
  const text = `${step?.title || ""} ${step?.subtitle || ""}`.toLowerCase();
  return text.includes("lipk") || text.includes("board") || text.includes("lauk") || text.includes("autobus");
}

function getCurrentTargetCoordinate(step?: JourneyStepLike | null, destinationCoordinate?: CoordinateLike | null, routeCoords: CoordinateLike[] = []) {
  if (step?.targetCoordinate) return step.targetCoordinate;
  if (routeCoords?.length) return routeCoords[routeCoords.length - 1];
  return destinationCoordinate || null;
}

export function usePrimaryAction({
  selectedMode,
  isPro,
  getFinalMode,
  mediumHaptic,
  runSmartRoute,
  animateSheet,
  handleOpenProPaywall,
  handleTransportResult,
  selectedRecommendation,
  pickupCoordinate,
  destinationCoordinate,
  routeCoords = [],
  currentStep,
  dynamicPrimaryLabel,
  dynamicPrimaryIcon,
}: UsePrimaryActionParams) {
  const handleDynamicTransitAction = async () => {
    const activeStep = currentStep || selectedRecommendation?.journeySteps?.[0] || null;
    const finalMode = String(selectedRecommendation?.mode || getFinalMode() || "bus");

    if (!(selectedMode === "smart" || selectedMode === "bus" || selectedMode === "train")) {
      await handleTransportResult(finalMode);
      return;
    }

    if (!selectedRecommendation?.journeySteps?.length) {
      await handleTransportResult(finalMode);
      return;
    }

    await mediumHaptic();

    if (hasWalkingLikeStep(activeStep) || activeStep?.kind === "walk_to_destination") {
      const endPoint = getCurrentTargetCoordinate(activeStep, destinationCoordinate || null, routeCoords);
      const url = buildWalkingUrl(pickupCoordinate, endPoint);
      const fallback = buildGoogleWalkingUrl(pickupCoordinate, endPoint);

      try {
        if (url) {
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
            return;
          }
        }

        if (fallback) {
          await Linking.openURL(fallback);
          return;
        }
      } catch {
        Alert.alert("Nepavyko atidaryti žemėlapio", "Atidarome žemėlapį maršruto peržiūrai programėlėje.");
      }
    }

    if (hasBoardLikeStep(activeStep) || activeStep?.kind === "wait_board" || activeStep?.kind === "ride" || activeStep?.kind === "alight") {
      animateSheet(SHEET_CLOSED_Y);
      return;
    }

    animateSheet(SHEET_OPEN_Y);
  };

  const handlePrimaryAction = async () => {
    const finalMode = getFinalMode();

    if (selectedMode === "smart" && !isPro) {
      await mediumHaptic();
      await handleOpenProPaywall("cta");
      return;
    }

    if (
      isPro &&
      (selectedMode === "smart" || selectedMode === "bus" || selectedMode === "train") &&
      selectedRecommendation?.journeySteps?.length
    ) {
      await handleDynamicTransitAction();
      return;
    }

    await mediumHaptic();

    if (selectedMode === "smart" && isPro) {
      await runSmartRoute();
      animateSheet(SHEET_OPEN_Y);
      return;
    }

    await handleTransportResult(String(finalMode));
  };

  return {
    handlePrimaryAction,
  };
}
