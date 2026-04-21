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
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabBar } from "../components/BottomTabBar";
import { useAuth } from "../core/auth/useAuth";

const STORAGE_KEYS = {
  homeLocation: "arbebus_home_location",
  workLocation: "arbebus_work_location",
};

type MdiIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type MenuRowProps = {
  icon: MdiIconName;
  title: string;
  subtitle?: string;
  value?: string;
  danger?: boolean;
  badge?: string;
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
        pointerEvents="none"
        intensity={Platform.OS === "ios" ? intensity : 18}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.glassCardBorder} />
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
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.88 }]}
    >
      {children}
    </Pressable>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  value,
  danger,
  badge,
  onPress,
}: MenuRowProps) {
  return (
    <UltraPressable onPress={onPress}>
      <View style={styles.menuRow}>
        <View
          style={[
            styles.menuRowIconWrap,
            danger && styles.menuRowIconWrapDanger,
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={danger ? "#FCA5A5" : "#EAF2FF"}
          />
        </View>

        <View style={styles.menuRowTextWrap}>
          <View style={styles.menuRowTitleLine}>
            <Text
              style={[
                styles.menuRowTitle,
                danger && styles.menuRowTitleDanger,
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

          {!!subtitle && <Text style={styles.menuRowSubtitle}>{subtitle}</Text>}
        </View>

        {value ? <Text style={styles.menuRowValue}>{value}</Text> : null}

        <Ionicons
          name="chevron-forward"
          size={18}
          color={danger ? "#FCA5A5" : "#8EA6CC"}
          style={{ marginLeft: 8 }}
        />
      </View>
    </UltraPressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export default function MenuScreen() {
  const router = useRouter();
  const { user, isGuest } = useAuth();

  const [homeLocation, setHomeLocation] = useState<string | null>(null);
  const [workLocation, setWorkLocation] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [delayAlertsEnabled, setDelayAlertsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [isPro, setIsPro] = useState(false);

  const userName = user?.fullName ?? "Guest User";
  const userEmail = user?.email ?? "guest@arbebus.app";
  const loginProvider = user?.provider ?? "guest";

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
    const loadSaved = async () => {
      try {
        const [savedHome, savedWork] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.homeLocation),
          AsyncStorage.getItem(STORAGE_KEYS.workLocation),
        ]);

        if (savedHome) setHomeLocation(savedHome);
        if (savedWork) setWorkLocation(savedWork);
      } catch (error) {
        console.log("Menu storage load error:", error);
      }
    };

    loadSaved();
  }, []);

  const initials = useMemo(() => {
    const parts = userName.trim().split(" ");
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [userName]);

  const handleBack = async () => {
    await tapHaptic();
    router.back();
  };

  const handleComingSoon = async (title: string) => {
    await mediumHaptic();
    Alert.alert(title, "Ši funkcija bus aktyvuota kitame etape.");
  };

  const handleEditProfile = async () => {
    await mediumHaptic();
    router.push("/profile");
  };

  const handleManagePro = async () => {
    await mediumHaptic();

    if (isPro) {
      Alert.alert("Arbebus PRO", "PRO jau aktyvuotas.");
      return;
    }

    Alert.alert(
      "Arbebus PRO",
      "Čia vėliau atidarysime PRO valdymą / prenumeratą."
    );
  };

  const handleSavedPlaces = async () => {
    await mediumHaptic();
    Alert.alert(
      "Išsaugotos vietos",
      `Namai: ${homeLocation ?? "nenustatyta"}\nDarbas: ${workLocation ?? "nenustatyta"}`
    );
  };

  const handleTransportHub = async (title: string) => {
    await mediumHaptic();
    Alert.alert(
      title,
      `${title} skiltis paruošta. Kitame etape prijungsime realią integraciją.`
    );
  };

  const handleSignIn = async () => {
    await mediumHaptic();
    router.push("/auth");
  };

  const handleSupport = async () => {
    await mediumHaptic();
    Alert.alert("Pagalba", "Galime pridėti support, FAQ ir kontaktų ekraną.");
  };

  const handleClearSavedPlaces = async () => {
    await mediumHaptic();

    Alert.alert("Išvalyti vietas", "Ar tikrai nori ištrinti Namai ir Darbas?", [
      { text: "Atšaukti", style: "cancel" },
      {
        text: "Ištrinti",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              STORAGE_KEYS.homeLocation,
              STORAGE_KEYS.workLocation,
            ]);
            setHomeLocation(null);
            setWorkLocation(null);
          } catch (error) {
            console.log("Clear places error:", error);
          }
        },
      },
    ]);
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

          <Text style={styles.screenTitle}>Menu</Text>

          <UltraPressable
            onPress={async () => {
              await tapHaptic();
              router.push("/");
            }}
          >
            <GlassCard style={styles.topIconButton}>
              <Ionicons name="home-outline" size={20} color="#F8FBFF" />
            </GlassCard>
          </UltraPressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <GlassCard style={styles.profileHero}>
            <View style={styles.heroGlow} />

            <View style={styles.profileTopRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials || "A"}</Text>
              </View>

              <View style={styles.profileTextWrap}>
                <View style={styles.profileNameRow}>
                  <Text style={styles.profileName}>{userName}</Text>

                  <View
                    style={[styles.proBadge, isPro && styles.proBadgeActive]}
                  >
                    <MaterialCommunityIcons
                      name="crown-outline"
                      size={13}
                      color={isPro ? "#0B1324" : "#F8D66D"}
                    />
                    <Text
                      style={[
                        styles.proBadgeText,
                        isPro && styles.proBadgeTextActive,
                      ]}
                    >
                      {isPro ? "PRO" : "FREE"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.profileEmail}>{userEmail}</Text>
                <Text style={styles.profileSubline}>
                  {isGuest ? "Guest režimas" : `Prisijungta per ${loginProvider}`}
                </Text>
              </View>
            </View>

            <View style={styles.heroActionRow}>
              <UltraPressable
                onPress={handleEditProfile}
                style={styles.heroActionPressable}
              >
                <View style={styles.heroActionChip}>
                  <Ionicons name="person-outline" size={16} color="#EAF2FF" />
                  <Text style={styles.heroActionText}>Redaguoti profilį</Text>
                </View>
              </UltraPressable>

              <UltraPressable
                onPress={handleManagePro}
                style={styles.heroActionPressable}
              >
                <View
                  style={[
                    styles.heroActionChip,
                    styles.heroActionChipPrimary,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="crown-outline"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text
                    style={[
                      styles.heroActionText,
                      styles.heroActionTextPrimary,
                    ]}
                  >
                    {isPro ? "Valdyti PRO" : "Atrakinti PRO"}
                  </Text>
                </View>
              </UltraPressable>
            </View>
          </GlassCard>

          <SectionTitle title="Account" />

          <GlassCard style={styles.sectionCard}>
            <MenuRow
              icon="login"
              title="Prisijungimas"
              subtitle="Apple, Google arba guest account"
              value={loginProvider}
              onPress={handleSignIn}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="account-edit-outline"
              title="Anketos užpildymas"
              subtitle="Kelionių prioritetai, namai, darbas, tikslai"
              onPress={handleEditProfile}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="shield-check-outline"
              title="Privatumas ir saugumas"
              subtitle="Leidimai, lokacija, duomenų valdymas"
              onPress={() => handleComingSoon("Privatumas ir saugumas")}
            />
          </GlassCard>

          <SectionTitle title="Saved places" />

          <GlassCard style={styles.sectionCard}>
            <MenuRow
              icon="home-city-outline"
              title="Namai"
              subtitle={homeLocation ?? "Dar nenustatyta"}
              onPress={handleSavedPlaces}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="briefcase-outline"
              title="Darbas"
              subtitle={workLocation ?? "Dar nenustatyta"}
              onPress={handleSavedPlaces}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="map-marker-multiple-outline"
              title="Visos išsaugotos vietos"
              subtitle="Namai, darbas, oro uostas ir favorite spot'ai"
              onPress={handleSavedPlaces}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="trash-can-outline"
              title="Išvalyti išsaugotas vietas"
              subtitle="Pašalinti Namai ir Darbas"
              danger
              onPress={handleClearSavedPlaces}
            />
          </GlassCard>

          <SectionTitle title="Mobility" />

          <GlassCard style={styles.sectionCard}>
            <MenuRow
              icon="bus-clock"
              title="Viešasis transportas"
              subtitle="Live autobusai, ETA ir maršrutai"
              badge="LIVE"
              onPress={() => handleTransportHub("Viešasis transportas")}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="train"
              title="Traukiniai"
              subtitle="Klaipėda region rail integracija"
              badge="NEW"
              onPress={() => handleTransportHub("Traukiniai")}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="taxi"
              title="Bolt taxi"
              subtitle="Greitas perėjimas į Bolt programėlę"
              badge="NEW"
              onPress={() => handleTransportHub("Bolt taxi")}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="airplane"
              title="Oro uostai"
              subtitle="Palanga, Vilnius, Kaunas"
              badge="NEW"
              onPress={() => handleTransportHub("Oro uostai")}
            />
          </GlassCard>

          <SectionTitle title="Trips & payments" />

          <GlassCard style={styles.sectionCard}>
            <MenuRow
              icon="history"
              title="Kelionių istorija"
              subtitle="Paskutinės kelionės ir maršrutai"
              onPress={() => router.push("/rides")}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="credit-card-outline"
              title="Mokėjimo metodai"
              subtitle="Kortelės, Apple Pay, future wallet"
              onPress={() => router.push("/pay")}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="receipt-text-outline"
              title="Pirkimų istorija"
              subtitle="PRO planai ir būsimi bilietų pirkimai"
              onPress={() => router.push("/wallet")}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="wallet-outline"
              title="Wallet"
              subtitle="Vienoje vietoje visi atsiskaitymai"
              onPress={() => router.push("/wallet")}
            />
          </GlassCard>

          <SectionTitle title="Preferences" />

          <GlassCard style={styles.sectionCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <View style={styles.menuRowIconWrap}>
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color="#EAF2FF"
                  />
                </View>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchTitle}>Push pranešimai</Text>
                  <Text style={styles.switchSubtitle}>
                    Bendri Arbebus pranešimai ir naujienos
                  </Text>
                </View>
              </View>

              <Switch
                value={notificationsEnabled}
                onValueChange={async (value) => {
                  await tapHaptic();
                  setNotificationsEnabled(value);
                }}
                trackColor={{ false: "#334155", true: "#4A86F7" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <View style={styles.menuRowIconWrap}>
                  <MaterialCommunityIcons
                    name="clock-alert-outline"
                    size={20}
                    color="#EAF2FF"
                  />
                </View>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchTitle}>Delay alerts</Text>
                  <Text style={styles.switchSubtitle}>
                    Įspėjimai jei transportas pradeda vėluoti
                  </Text>
                </View>
              </View>

              <Switch
                value={delayAlertsEnabled}
                onValueChange={async (value) => {
                  await tapHaptic();
                  setDelayAlertsEnabled(value);
                }}
                trackColor={{ false: "#334155", true: "#4A86F7" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <View style={styles.menuRowIconWrap}>
                  <Ionicons name="moon-outline" size={20} color="#EAF2FF" />
                </View>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchTitle}>Dark mode</Text>
                  <Text style={styles.switchSubtitle}>
                    Premium tamsi Arbebus sąsaja
                  </Text>
                </View>
              </View>

              <Switch
                value={darkModeEnabled}
                onValueChange={async (value) => {
                  await tapHaptic();
                  setDarkModeEnabled(value);
                }}
                trackColor={{ false: "#334155", true: "#4A86F7" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </GlassCard>

          <SectionTitle title="Help & legal" />

          <GlassCard style={styles.sectionCard}>
            <MenuRow
              icon="lifebuoy"
              title="Pagalba"
              subtitle="Support ir kontaktai"
              onPress={handleSupport}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="frequently-asked-questions"
              title="DUK"
              subtitle="Dažniausiai užduodami klausimai"
              onPress={() => handleComingSoon("DUK")}
            />
            <View style={styles.rowDivider} />

            <MenuRow
              icon="file-document-outline"
              title="Taisyklės ir privatumas"
              subtitle="Naudojimo sąlygos ir privatumo politika"
              onPress={() => handleComingSoon("Taisyklės ir privatumas")}
            />
          </GlassCard>

          <View style={styles.footerSpace} />
        </ScrollView>

        <BottomTabBar activeTab="menu" />
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

  profileHero: {
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
    overflow: "hidden",
  },

  heroGlow: {
    position: "absolute",
    top: -26,
    left: 10,
    width: 180,
    height: 90,
    borderRadius: 90,
    backgroundColor: "rgba(96,165,250,0.14)",
  },

  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
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

  profileTextWrap: {
    flex: 1,
  },

  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  profileName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginRight: 10,
  },

  profileEmail: {
    color: "#AFC3E6",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },

  profileSubline: {
    color: "#D8E4F5",
    fontSize: 13,
    fontWeight: "700",
  },

  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.28)",
  },

  proBadgeActive: {
    backgroundColor: "#F8D66D",
    borderColor: "#F8D66D",
  },

  proBadgeText: {
    color: "#F8D66D",
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 5,
  },

  proBadgeTextActive: {
    color: "#0B1324",
  },

  heroActionRow: {
    flexDirection: "row",
    marginTop: 16,
  },

  heroActionPressable: {
    flex: 1,
    marginRight: 8,
  },

  heroActionChip: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  heroActionChipPrimary: {
    backgroundColor: "#4A86F7",
    borderColor: "rgba(255,255,255,0.16)",
  },

  heroActionText: {
    color: "#EAF2FF",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 8,
  },

  heroActionTextPrimary: {
    color: "#FFFFFF",
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

  sectionCard: {
    borderRadius: 24,
    paddingVertical: 2,
    marginBottom: 18,
    overflow: "hidden",
  },

  menuRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  menuRowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 12,
  },

  menuRowIconWrapDanger: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },

  menuRowTextWrap: {
    flex: 1,
  },

  menuRowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },

  menuRowTitle: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "900",
  },

  menuRowTitleDanger: {
    color: "#FCA5A5",
  },

  menuRowSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    paddingRight: 8,
  },

  menuRowValue: {
    color: "#D8E4F5",
    fontSize: 12,
    fontWeight: "800",
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

  switchRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  switchLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },

  switchTextWrap: {
    flex: 1,
  },

  switchTitle: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },

  switchSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  footerSpace: {
    height: 20,
  },
});