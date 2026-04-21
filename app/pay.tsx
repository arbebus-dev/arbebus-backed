import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabBar } from "../components/BottomTabBar";

const STORAGE_KEYS = {
  profileName: "arbebus_profile_name",
  activeRideEnabled: "arbebus_active_ride_enabled",
};

type MdiIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type RideItem = {
  id: string;
  title: string;
  subtitle: string;
  eta?: string;
  price?: string;
  icon: MdiIconName;
  status?: string;
};

type RouteItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: MdiIconName;
};

type ActionRowProps = {
  icon: MdiIconName;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: string;
  danger?: boolean;
  onPress: () => void;
};

function GlassCard({
  children,
  style,
  intensity = 30,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
}) {
  return (
    <View style={[styles.glassCardWrap, style]}>
      <BlurView
        intensity={Platform.OS === "ios" ? intensity : 18}
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
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.88 }]}
    >
      {children}
    </Pressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ActionRow({
  icon,
  title,
  subtitle,
  value,
  badge,
  danger,
  onPress,
}: ActionRowProps) {
  return (
    <UltraPressable onPress={onPress}>
      <View style={styles.actionRow}>
        <View
          style={[
            styles.actionRowIconWrap,
            danger && styles.actionRowIconWrapDanger,
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={danger ? "#FCA5A5" : "#EAF2FF"}
          />
        </View>

        <View style={styles.actionRowTextWrap}>
          <View style={styles.actionRowTitleLine}>
            <Text
              style={[
                styles.actionRowTitle,
                danger && styles.actionRowTitleDanger,
              ]}
            >
              {title}
            </Text>

            {badge ? (
              <View style={styles.rowBadge}>
                <Text style={styles.rowBadgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>

          {!!subtitle && (
            <Text style={styles.actionRowSubtitle}>{subtitle}</Text>
          )}
        </View>

        {value ? <Text style={styles.actionRowValue}>{value}</Text> : null}

        <Ionicons name="chevron-forward" size={18} color="#8EA6CC" />
      </View>
    </UltraPressable>
  );
}

function RideCard({ item }: { item: RideItem }) {
  return (
    <View style={styles.rideCard}>
      <View style={styles.rideCardTop}>
        <View style={styles.rideCardIconWrap}>
          <MaterialCommunityIcons name={item.icon} size={20} color="#FFFFFF" />
        </View>

        <View style={styles.rideCardTextWrap}>
          <View style={styles.rideCardTitleLine}>
            <Text style={styles.rideCardTitle}>{item.title}</Text>
            {item.status ? (
              <View style={styles.rideStatusBadge}>
                <Text style={styles.rideStatusText}>{item.status}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rideCardSubtitle}>{item.subtitle}</Text>
        </View>
      </View>

      {(item.eta || item.price) && (
        <View style={styles.rideMetaRow}>
          {item.eta ? (
            <View style={styles.rideMetaPill}>
              <Ionicons name="time-outline" size={14} color="#DCE7FF" />
              <Text style={styles.rideMetaPillText}>{item.eta}</Text>
            </View>
          ) : null}

          {item.price ? (
            <View style={styles.rideMetaPill}>
              <MaterialCommunityIcons name="cash" size={14} color="#DCE7FF" />
              <Text style={styles.rideMetaPillText}>{item.price}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function SavedRouteCard({ item }: { item: RouteItem }) {
  return (
    <View style={styles.savedRouteCard}>
      <View style={styles.savedRouteIconWrap}>
        <MaterialCommunityIcons name={item.icon} size={18} color="#EAF2FF" />
      </View>

      <View style={styles.savedRouteTextWrap}>
        <Text style={styles.savedRouteTitle}>{item.title}</Text>
        <Text style={styles.savedRouteSubtitle}>{item.subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#8EA6CC" />
    </View>
  );
}

export default function RidesScreen() {
  const router = useRouter();

  const [profileName, setProfileName] = useState("Edgaras");
  const [hasActiveRide, setHasActiveRide] = useState(true);

  const tapHaptic = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  const mediumHaptic = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedName, savedActiveRide] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.profileName),
          AsyncStorage.getItem(STORAGE_KEYS.activeRideEnabled),
        ]);

        if (savedName) setProfileName(savedName);
        if (savedActiveRide != null) {
          setHasActiveRide(savedActiveRide === "true");
        }
      } catch (error) {
        console.log("Rides load error:", error);
      }
    };

    loadData();
  }, []);

  const initials = useMemo(() => {
    const parts = profileName.trim().split(" ");
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [profileName]);

  const upcomingRides: RideItem[] = [
    {
      id: "u1",
      title: "Rytoj į darbą",
      subtitle: "Klaipėda centras → Tiltų g. 1",
      eta: "08:10",
      price: "€0.80",
      icon: "bus",
      status: "PLANNED",
    },
    {
      id: "u2",
      title: "Palanga Airport trip",
      subtitle: "Bus + taxi rekomendacija",
      eta: "06:40",
      price: "€4.90",
      icon: "airplane",
      status: "UPCOMING",
    },
  ];

  const historyRides: RideItem[] = [
    {
      id: "h1",
      title: "Klaipėda → Senamiestis",
      subtitle: "Taxi route • vakar",
      eta: "9 min",
      price: "€5.80",
      icon: "taxi",
      status: "DONE",
    },
    {
      id: "h2",
      title: "Darbas → Namai",
      subtitle: "Bus route • vakar",
      eta: "14 min",
      price: "€0.80",
      icon: "bus-clock",
      status: "DONE",
    },
    {
      id: "h3",
      title: "Region train ride",
      subtitle: "Klaipėda → Kretinga",
      eta: "18 min",
      price: "€1.80",
      icon: "train",
      status: "DONE",
    },
  ];

  const savedRoutes: RouteItem[] = [
    {
      id: "s1",
      title: "Namai → Darbas",
      subtitle: "Kasdienis rytinis maršrutas",
      icon: "home-city-outline",
    },
    {
      id: "s2",
      title: "Darbas → Namai",
      subtitle: "Vakarinis grįžimo maršrutas",
      icon: "briefcase-outline",
    },
    {
      id: "s3",
      title: "Klaipėda → Palanga Airport",
      subtitle: "Airport shortcut",
      icon: "airplane",
    },
  ];

  const handleBack = async () => {
    await tapHaptic();
    router.back();
  };

  const handleOpenHome = async () => {
    await tapHaptic();
    router.push("/");
  };

  const handleContinueRide = async () => {
    await mediumHaptic();
    Alert.alert("Active ride", "Čia vėliau jungsime gyvą aktyvios kelionės ekraną.");
  };

  const handleCancelRide = async () => {
    await mediumHaptic();

    Alert.alert("Atšaukti kelionę", "Ar tikrai nori atšaukti aktyvią kelionę?", [
      { text: "Atgal", style: "cancel" },
      {
        text: "Atšaukti",
        style: "destructive",
        onPress: async () => {
          setHasActiveRide(false);
          try {
            await AsyncStorage.setItem(
              STORAGE_KEYS.activeRideEnabled,
              "false"
            );
          } catch {}
        },
      },
    ]);
  };

  const handleRebook = async (title: string) => {
    await mediumHaptic();
    Alert.alert("Pakartoti kelionę", `Čia paleisime quick rebook: ${title}`);
  };

  const handleSavedRoute = async (title: string) => {
    await mediumHaptic();
    Alert.alert("Saved route", `Atidaromas maršrutas: ${title}`);
  };

  const handleComingSoon = async (title: string) => {
    await mediumHaptic();
    Alert.alert(title, "Ši funkcija bus aktyvuota kitame etape.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <UltraPressable onPress={handleBack}>
            <GlassCard style={styles.topIconButton}>
              <Ionicons name="chevron-back" size={22} color="#F8FBFF" />
            </GlassCard>
          </UltraPressable>

          <Text style={styles.screenTitle}>Rides</Text>

          <UltraPressable onPress={handleOpenHome}>
            <GlassCard style={styles.topIconButton}>
              <Ionicons name="home-outline" size={20} color="#F8FBFF" />
            </GlassCard>
          </UltraPressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroGlow} />

            <View style={styles.heroTopRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials || "A"}</Text>
              </View>

              <View style={styles.heroTextWrap}>
                <Text style={styles.heroName}>{profileName}</Text>
                <Text style={styles.heroSubtitle}>
                  Visos tavo aktyvios, būsimos ir buvusios kelionės
                </Text>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatValue}>12</Text>
                <Text style={styles.heroStatLabel}>Šio mėn. rides</Text>
              </View>

              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatValue}>€18.40</Text>
                <Text style={styles.heroStatLabel}>Transport spend</Text>
              </View>

              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatValue}>4 min</Text>
                <Text style={styles.heroStatLabel}>Avg ETA</Text>
              </View>
            </View>
          </GlassCard>

          <SectionTitle title="Active ride" />

          {hasActiveRide ? (
            <GlassCard style={styles.activeRideCard}>
              <View style={styles.activeRideTopRow}>
                <View style={styles.activeRideLeft}>
                  <View style={styles.activeRideIconWrap}>
                    <MaterialCommunityIcons
                      name="taxi"
                      size={22}
                      color="#FFFFFF"
                    />
                  </View>

                  <View style={styles.activeRideTextWrap}>
                    <View style={styles.activeRideTitleRow}>
                      <Text style={styles.activeRideTitle}>Bolt driver atvyksta</Text>

                      <View style={styles.activeRideStatusBadge}>
                        <Text style={styles.activeRideStatusText}>LIVE</Text>
                      </View>
                    </View>

                    <Text style={styles.activeRideSubtitle}>
                      Driver Tomas • Toyota Prius • ETA 3 min
                    </Text>
                    <Text style={styles.activeRideRoute}>
                      Klaipėda centras → Akropolis
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.activeRideMetaRow}>
                <View style={styles.activeRideMetaPill}>
                  <Ionicons name="time-outline" size={14} color="#DCE7FF" />
                  <Text style={styles.activeRideMetaText}>3 min</Text>
                </View>

                <View style={styles.activeRideMetaPill}>
                  <MaterialCommunityIcons name="cash" size={14} color="#DCE7FF" />
                  <Text style={styles.activeRideMetaText}>€5.80</Text>
                </View>

                <View style={styles.activeRideMetaPill}>
                  <MaterialCommunityIcons
                    name="map-marker-distance"
                    size={14}
                    color="#DCE7FF"
                  />
                  <Text style={styles.activeRideMetaText}>2.4 km</Text>
                </View>
              </View>

              <View style={styles.activeRideButtonsRow}>
                <UltraPressable
                  onPress={handleContinueRide}
                  style={styles.activeRideButtonPressable}
                >
                  <View style={styles.primaryButton}>
                    <MaterialCommunityIcons
                      name="navigation-variant-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.primaryButtonText}>Tęsti</Text>
                  </View>
                </UltraPressable>

                <UltraPressable
                  onPress={handleCancelRide}
                  style={styles.activeRideButtonPressable}
                >
                  <View style={styles.secondaryButton}>
                    <Ionicons name="close-outline" size={18} color="#FCA5A5" />
                    <Text style={styles.secondaryButtonTextDanger}>Atšaukti</Text>
                  </View>
                </UltraPressable>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons
                  name="car-clock"
                  size={24}
                  color="#8ED8FF"
                />
              </View>
              <Text style={styles.emptyTitle}>Nėra aktyvios kelionės</Text>
              <Text style={styles.emptySubtitle}>
                Kai užsakysi taxi arba pradėsi maršrutą, jis atsiras čia.
              </Text>

              <UltraPressable
                onPress={handleOpenHome}
                style={styles.emptyButtonPressable}
              >
                <View style={styles.primaryButton}>
                  <Ionicons name="home-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Grįžti į Home</Text>
                </View>
              </UltraPressable>
            </GlassCard>
          )}

          <SectionTitle title="Upcoming rides" />

          <GlassCard style={styles.sectionCard}>
            {upcomingRides.map((item, index) => (
              <View key={item.id}>
                <UltraPressable onPress={() => handleRebook(item.title)}>
                  <RideCard item={item} />
                </UltraPressable>
                {index < upcomingRides.length - 1 ? (
                  <View style={styles.rowDivider} />
                ) : null}
              </View>
            ))}
          </GlassCard>

          <SectionTitle title="Saved routes" />

          <GlassCard style={styles.sectionCard}>
            {savedRoutes.map((item, index) => (
              <View key={item.id}>
                <UltraPressable onPress={() => handleSavedRoute(item.title)}>
                  <SavedRouteCard item={item} />
                </UltraPressable>
                {index < savedRoutes.length - 1 ? (
                  <View style={styles.rowDivider} />
                ) : null}
              </View>
            ))}
          </GlassCard>

          <SectionTitle title="Ride history" />

          <GlassCard style={styles.sectionCard}>
            {historyRides.map((item, index) => (
              <View key={item.id}>
                <UltraPressable onPress={() => handleRebook(item.title)}>
                  <RideCard item={item} />
                </UltraPressable>
                {index < historyRides.length - 1 ? (
                  <View style={styles.rowDivider} />
                ) : null}
              </View>
            ))}
          </GlassCard>

          <SectionTitle title="Ride actions" />

          <GlassCard style={styles.sectionCard}>
            <ActionRow
              icon="history"
              title="Visa istorija"
              subtitle="Pilna visų kelionių ir maršrutų istorija"
              onPress={() => handleComingSoon("Visa istorija")}
            />
            <View style={styles.rowDivider} />

            <ActionRow
              icon="star-outline"
              title="Mėgstami maršrutai"
              subtitle="Quick rebook dažniausiems keliams"
              badge="FAST"
              onPress={() => handleComingSoon("Mėgstami maršrutai")}
            />
            <View style={styles.rowDivider} />

            <ActionRow
              icon="ticket-confirmation-outline"
              title="Ride receipts"
              subtitle="Apmokėjimų kvitai ir detali istorija"
              onPress={() => handleComingSoon("Ride receipts")}
            />
            <View style={styles.rowDivider} />

            <ActionRow
              icon="alert-circle-outline"
              title="Problema su kelione"
              subtitle="Pagalba dėl ride, vairuotojo ar maršruto"
              danger
              onPress={() => handleComingSoon("Problema su kelione")}
            />
          </GlassCard>

          <View style={styles.footerSpace} />
        </ScrollView>

        <BottomTabBar activeTab="rides" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  screenTitle: {
    color: "#F8FBFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  topIconButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  glassCardWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10,20,40,0.28)",
  },

  glassCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  glassCardInner: {
    position: "relative",
  },

  heroCard: {
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
    overflow: "hidden",
  },

  heroGlow: {
    position: "absolute",
    top: -26,
    left: 10,
    width: 190,
    height: 90,
    borderRadius: 90,
    backgroundColor: "rgba(96,165,250,0.14)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A86F7",
    marginRight: 14,
    shadowColor: "#2563EB",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  heroTextWrap: {
    flex: 1,
  },

  heroName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },

  heroSubtitle: {
    color: "#AFC3E6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  heroStatCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 18,
    padding: 12,
    marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
  },

  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },

  heroStatLabel: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  sectionTitle: {
    color: "#8CCBFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
    marginLeft: 4,
  },

  activeRideCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    overflow: "hidden",
  },

  activeRideTopRow: {
    marginBottom: 14,
  },

  activeRideLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  activeRideIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A86F7",
    marginRight: 12,
  },

  activeRideTextWrap: {
    flex: 1,
  },

  activeRideTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },

  activeRideTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginRight: 8,
  },

  activeRideStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.18)",
  },

  activeRideStatusText: {
    color: "#86EFAC",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  activeRideSubtitle: {
    color: "#D8E4F5",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },

  activeRideRoute: {
    color: "#8EA6CC",
    fontSize: 12,
    fontWeight: "700",
  },

  activeRideMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },

  activeRideMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginRight: 8,
    marginBottom: 8,
  },

  activeRideMetaText: {
    color: "#EAF2FF",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6,
  },

  activeRideButtonsRow: {
    flexDirection: "row",
  },

  activeRideButtonPressable: {
    flex: 1,
    marginRight: 8,
  },

  primaryButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "#4A86F7",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#2563EB",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 8,
  },

  secondaryButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  secondaryButtonTextDanger: {
    color: "#FCA5A5",
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 8,
  },

  emptyCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    alignItems: "center",
  },

  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.12)",
    marginBottom: 12,
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  emptySubtitle: {
    color: "#8EA6CC",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },

  emptyButtonPressable: {
    width: "100%",
  },

  sectionCard: {
    borderRadius: 24,
    paddingVertical: 2,
    marginBottom: 18,
    overflow: "hidden",
  },

  rideCard: {
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },

  rideCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  rideCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,134,247,0.22)",
    marginRight: 12,
  },

  rideCardTextWrap: {
    flex: 1,
  },

  rideCardTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },

  rideCardTitle: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "900",
    marginRight: 8,
  },

  rideCardSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  rideStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.16)",
  },

  rideStatusText: {
    color: "#8ED8FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  rideMetaRow: {
    flexDirection: "row",
    marginTop: 10,
    marginLeft: 56,
  },

  rideMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginRight: 8,
  },

  rideMetaPillText: {
    color: "#DCE7FF",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 6,
  },

  savedRouteCard: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  savedRouteIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 12,
  },

  savedRouteTextWrap: {
    flex: 1,
  },

  savedRouteTitle: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },

  savedRouteSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  actionRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  actionRowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 12,
  },

  actionRowIconWrapDanger: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },

  actionRowTextWrap: {
    flex: 1,
  },

  actionRowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },

  actionRowTitle: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "900",
  },

  actionRowTitleDanger: {
    color: "#FCA5A5",
  },

  actionRowSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    paddingRight: 8,
  },

  actionRowValue: {
    color: "#D8E4F5",
    fontSize: 12,
    fontWeight: "800",
    marginRight: 8,
    marginLeft: 8,
  },

  rowBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.16)",
  },

  rowBadgeText: {
    color: "#8ED8FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  rowDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 68,
    marginRight: 12,
  },

  footerSpace: {
    height: 20,
  },
});