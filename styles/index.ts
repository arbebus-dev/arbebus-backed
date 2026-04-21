import { Dimensions, StyleSheet } from "react-native";
import { SHEET_HEIGHT } from "../constants/home";

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },

  map: {
    width,
    height,
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

  floatingAiCardWrap: {
    position: "absolute",
    top: 96,
    left: 16,
    right: 16,
    zIndex: 19,
  },

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

  aiHudWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  aiStatusHud: {
    width: "100%",
    maxWidth: 170,
    minHeight: 54,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(7,18,38,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    overflow: "hidden",
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

  aiStatusTextWrap: {
    flex: 1,
    justifyContent: "center",
  },

  aiStatusTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  aiStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.10)",
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

  aiStatusHeadline: {
    color: "#F8FBFF",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 4,
  },

  aiStatusValue: {
    color: "#AFC3E6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  aiWeatherChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  aiWeatherChipText: {
    color: "#EAF2FF",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6,
  },

  cornerMenuButton: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7, 18, 38, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: "hidden",
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

  glassTopHighlight: {
    position: "absolute",
    top: 0,
    left: 6,
    right: 6,
    height: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020817",
  },

  customMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  markerImage: {
    width: 34,
    height: 34,
    backgroundColor: "transparent",
  },

  markerImageBest: {
    width: 42,
    height: 42,
    backgroundColor: "transparent",
  },

  markerLabelPill: {
    marginTop: -4,
    minWidth: 40,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    borderWidth: 1,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },

  markerLabelPillBest: {
    backgroundColor: "#0ea5ff",
  },

  markerLabelText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },

  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    zIndex: 999,
    elevation: 30,
    backgroundColor: "rgba(7,22,47,0.96)",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -10 },
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  sheetTopDragArea: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: "#07162F",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },

  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    marginBottom: 10,
  },

  modeChipsHorizontalContent: {
    paddingRight: 8,
  },

  modeChipHorizontalItem: {
    width: 150,
    marginRight: 8,
  },

  modeChipsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    flexWrap: "nowrap",
    justifyContent: "space-between",
    marginBottom: 2,
  },

  modeChipPressable: {
    flex: 1,
  },

  modeChip: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },

  modeChipGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },

  modeChipIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 6,
  },

  modeChipIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  modeChipText: {
    color: "#D8E6FF",
    fontSize: 11,
    fontWeight: "800",
    flexShrink: 1,
  },

  modeChipTextActive: {
    color: "#FFFFFF",
  },

  modeChipActive: {
    shadowColor: "#3B82F6",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  modeChipPressed: {
    opacity: 0.88,
  },

  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  compactRecommendationsCard: {
    borderRadius: 28,
    backgroundColor: "rgba(10,29,61,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    marginTop: 6,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    overflow: "hidden",
  },

  cardTopGlow: {
    position: "absolute",
    top: -24,
    left: 20,
    width: 180,
    height: 80,
    borderRadius: 80,
    backgroundColor: "rgba(96,165,250,0.14)",
  },

  cardBottomShade: {
    position: "absolute",
    bottom: -20,
    right: -10,
    width: 160,
    height: 70,
    borderRadius: 70,
    backgroundColor: "rgba(2,6,23,0.16)",
  },

  compactRecommendationsTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  compactRecommendationsHeader: {
    flex: 1,
    paddingRight: 12,
  },

  smartPickHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  compactRecommendationsEyebrow: {
    color: "#8CCBFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    flexShrink: 1,
    paddingRight: 10,
  },

  smartPickLaterText: {
    color: "#D9E4F5",
    fontSize: 14,
    fontWeight: "700",
  },

  compactRecommendationsTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
    letterSpacing: -0.4,
  },

  compactRecommendationsSubtitle: {
    color: "#D8E4F5",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  compactEtaPill: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "flex-end",
    overflow: "hidden",
  },

  compactEtaPillGlow: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  compactEtaPillValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  compactEtaPillMeta: {
    color: "#9FB4D9",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },

  compactShortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    flexWrap: "nowrap",
  },

  compactShortcutPressable: {
    marginRight: 6,
  },

  compactShortcutChip: {
    flexDirection: "row",
    alignItems: "center",
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  compactShortcutIcon: {
    marginRight: 8,
  },

  compactShortcutEmoji: {
    fontSize: 14,
    marginRight: 8,
  },

  compactShortcutText: {
    color: "#EAF2FF",
    fontSize: 13,
    fontWeight: "800",
  },

  compactRefreshChip: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },

  compactLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },

  compactBusBadge: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(96,165,250,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    paddingHorizontal: 10,
  },

  compactBusBadgeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  compactLiveTextWrap: {
    flex: 1,
  },

  compactLiveText: {
    color: "#F8FBFF",
    fontSize: 14,
    fontWeight: "900",
  },

  compactLiveSubtext: {
    color: "#8EA6CC",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  compactCtaButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: "#4A86F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#2563EB",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: "hidden",
  },

  compactCtaIcon: {
    marginRight: 10,
  },

  compactCtaButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  ctaTopHighlight: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  bottomTabBarWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1005,
    elevation: 40,
  },

  bottomTabBar: {
    borderRadius: 22,
    backgroundColor: "#07162F",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },

  bottomTabItem: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomTabItemActive: {
    backgroundColor: "#F8FAFC",
  },

  bottomTabLabel: {
    color: "#C7D2E5",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  bottomTabLabelActive: {
    color: "#0F172A",
  },

  driverInfoCard: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1002,
    elevation: 32,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 24,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.05)",
    overflow: "hidden",
  },

  driverCardGlow: {
    position: "absolute",
    top: -12,
    left: 14,
    width: 120,
    height: 44,
    borderRadius: 44,
    backgroundColor: "rgba(37,99,235,0.08)",
  },

  driverInfoTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },

  driverMainInfo: {
    flex: 1,
  },

  driverName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },

  driverMeta: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },

  driverEtaPill: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  driverEtaPillText: {
    color: "#0369A1",
    fontSize: 12,
    fontWeight: "900",
  },

  cancelRideButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelRideButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  rideSummaryCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 140,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    maxHeight: height - 260,
    overflow: "hidden",
  },

  rideSummaryGlow: {
    position: "absolute",
    top: -10,
    left: 16,
    width: 140,
    height: 44,
    borderRadius: 44,
    backgroundColor: "rgba(37,99,235,0.08)",
  },

  rideSummaryTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 14,
    textAlign: "center",
  },

  rideSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  rideSummaryLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },

  rideSummaryValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
    marginLeft: 12,
    flexShrink: 1,
    textAlign: "right",
  },

  rideSummaryButton: {
    marginTop: 10,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  rideSummaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  loadingOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 100,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },

  loadingText: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },

  paywallOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  paywallCard: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: "#071a3b",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(80,140,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    overflow: "hidden",
  },

  paywallGlow: {
    position: "absolute",
    top: -18,
    left: 18,
    width: 150,
    height: 60,
    borderRadius: 60,
    backgroundColor: "rgba(56,189,248,0.09)",
  },

  paywallBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#0ea5ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },

  paywallBadgeText: {
    color: "#061538",
    fontSize: 12,
    fontWeight: "800",
  },

  paywallTitle: {
    color: "white",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
  },

  paywallSubtitle: {
    color: "#b7c5df",
    fontSize: 15,
    marginBottom: 18,
  },

  paywallFeatures: {
    marginBottom: 18,
  },

  paywallFeature: {
    color: "#e5eefc",
    fontSize: 16,
    marginBottom: 8,
  },

  paywallPriceBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  paywallPrice: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },

  paywallPriceNote: {
    color: "#9fb4d9",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },

  paywallButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#25a7ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  paywallButtonText: {
    color: "#061538",
    fontSize: 18,
    fontWeight: "800",
  },

  paywallSecondaryButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  paywallSecondaryButtonText: {
    color: "#d9e2f0",
    fontSize: 16,
    fontWeight: "700",
  },

  paywallClose: {
    color: "#8ea0c4",
    textAlign: "center",
    fontSize: 15,
  },

  onboardingScreen: {
    flex: 1,
    backgroundColor: "#08111f",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  onboardingCard: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#071a3b",
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  onboardingCardGlow: {
    position: "absolute",
    top: -14,
    left: 20,
    width: 160,
    height: 60,
    borderRadius: 60,
    backgroundColor: "rgba(56,189,248,0.08)",
  },

  onboardingIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "rgba(56,189,248,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  onboardingTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 10,
  },

  onboardingSubtitle: {
    color: "#bfd0ec",
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 24,
  },

  onboardingDots: {
    flexDirection: "row",
    marginBottom: 24,
  },

  onboardingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginRight: 8,
  },

  onboardingDotActive: {
    backgroundColor: "#38bdf8",
    width: 22,
  },

  onboardingPrimaryBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#25a7ff",
    alignItems: "center",
    justifyContent: "center",
  },

  onboardingPrimaryText: {
    color: "#061538",
    fontSize: 18,
    fontWeight: "800",
  },

    backendStatusCard: {
    position: "absolute",
    top: 108,
    left: 16,
    right: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(245,158,11,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    zIndex: 25,
  },

  backendStatusTitle: {
    color: "#FDE68A",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },

  backendStatusText: {
    color: "#F8E7B0",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  emptyStateCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 170,
    borderRadius: 22,
    padding: 18,
    backgroundColor: "rgba(7,22,47,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    zIndex: 24,
  },

  emptyStateTitle: {
    color: "#F8FBFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
    textAlign: "center",
  },

  emptyStateText: {
    color: "#AFC3E6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  cachedBadge: {
    position: "absolute",
    top: 78,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    zIndex: 26,
  },

  cachedBadgeText: {
    color: "#DCE7FF",
    fontSize: 12,
    fontWeight: "800",
  },

  onboardingSkip: {
    color: "#9fb4d9",
    textAlign: "center",
    fontSize: 15,
    marginTop: 14,
  },
});

export default styles;