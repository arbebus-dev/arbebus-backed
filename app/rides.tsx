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
  profileEmail: "arbebus_profile_email",
  walletBalance: "arbebus_wallet_balance",
  proActive: "arbebus_pro_active",
  defaultPaymentMethod: "arbebus_default_payment_method",
};

type MdiIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type WalletRowProps = {
  icon: MdiIconName;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: string;
  danger?: boolean;
  onPress: () => void;
};

type PurchaseItem = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  icon: MdiIconName;
  status?: string;
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

function WalletRow({
  icon,
  title,
  subtitle,
  value,
  badge,
  danger,
  onPress,
}: WalletRowProps) {
  return (
    <UltraPressable onPress={onPress}>
      <View style={styles.walletRow}>
        <View
          style={[
            styles.walletRowIconWrap,
            danger && styles.walletRowIconWrapDanger,
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={danger ? "#FCA5A5" : "#EAF2FF"}
          />
        </View>

        <View style={styles.walletRowTextWrap}>
          <View style={styles.walletRowTitleLine}>
            <Text
              style={[
                styles.walletRowTitle,
                danger && styles.walletRowTitleDanger,
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
            <Text style={styles.walletRowSubtitle}>{subtitle}</Text>
          )}
        </View>

        {value ? <Text style={styles.walletRowValue}>{value}</Text> : null}

        <Ionicons
          name="chevron-forward"
          size={18}
          color={danger ? "#FCA5A5" : "#8EA6CC"}
        />
      </View>
    </UltraPressable>
  );
}

function PurchaseHistoryItem({ item }: { item: PurchaseItem }) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIconWrap}>
        <MaterialCommunityIcons name={item.icon} size={18} color="#EAF2FF" />
      </View>

      <View style={styles.historyTextWrap}>
        <View style={styles.historyTitleLine}>
          <Text style={styles.historyTitle}>{item.title}</Text>
          {item.status ? (
            <View style={styles.historyStatusBadge}>
              <Text style={styles.historyStatusText}>{item.status}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.historySubtitle}>{item.subtitle}</Text>
      </View>

      <Text style={styles.historyAmount}>{item.amount}</Text>
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();

  const [profileName, setProfileName] = useState("Edgaras");
  const [profileEmail, setProfileEmail] = useState("guest@arbebus.app");
  const [walletBalance, setWalletBalance] = useState("€0.00");
  const [isPro, setIsPro] = useState(false);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState("Apple Pay");

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
    const loadWalletData = async () => {
      try {
        const [
          savedName,
          savedEmail,
          savedBalance,
          savedPro,
          savedPaymentMethod,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.profileName),
          AsyncStorage.getItem(STORAGE_KEYS.profileEmail),
          AsyncStorage.getItem(STORAGE_KEYS.walletBalance),
          AsyncStorage.getItem(STORAGE_KEYS.proActive),
          AsyncStorage.getItem(STORAGE_KEYS.defaultPaymentMethod),
        ]);

        if (savedName) setProfileName(savedName);
        if (savedEmail) setProfileEmail(savedEmail);
        if (savedBalance) setWalletBalance(savedBalance);
        if (savedPro != null) setIsPro(savedPro === "true");
        if (savedPaymentMethod) setDefaultPaymentMethod(savedPaymentMethod);
      } catch (error) {
        console.log("Wallet load error:", error);
      }
    };

    loadWalletData();
  }, []);

  const initials = useMemo(() => {
    const parts = profileName.trim().split(" ");
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [profileName]);

  const purchaseHistory: PurchaseItem[] = [
    {
      id: "1",
      title: "Arbebus PRO",
      subtitle: "Mėnesinis planas • 2026-04-06",
      amount: "€2.99",
      icon: "crown-outline",
      status: "PAID",
    },
    {
      id: "2",
      title: "Demo wallet top-up",
      subtitle: "Future transport credits • 2026-04-05",
      amount: "€10.00",
      icon: "wallet-plus-outline",
      status: "TOP UP",
    },
    {
      id: "3",
      title: "Airport route pass",
      subtitle: "Palanga airport future ticket placeholder",
      amount: "€1.80",
      icon: "airplane",
      status: "SOON",
    },
  ];

  const handleBack = async () => {
    await tapHaptic();
    router.back();
  };

  const handleTopUp = async () => {
    await mediumHaptic();
    Alert.alert(
      "Papildyti wallet",
      "Čia vėliau prijungsime wallet papildymą per kortelę / Apple Pay."
    );
  };

  const handleManagePro = async () => {
    await mediumHaptic();

    if (isPro) {
      Alert.alert(
        "Arbebus PRO",
        "PRO aktyvus. Čia vėliau bus prenumeratos valdymas."
      );
      return;
    }

    Alert.alert(
      "Arbebus PRO",
      "Čia vėliau bus PRO aktyvavimas ir planų pasirinkimas."
    );
  };

  const handlePaymentMethods = async () => {
    await mediumHaptic();
    Alert.alert(
      "Mokėjimo metodai",
      `Numatytasis metodas: ${defaultPaymentMethod}\n\nČia vėliau prijungsime korteles ir Apple Pay / Google Pay.`
    );
  };

  const handlePurchaseHistory = async () => {
    await mediumHaptic();
    Alert.alert(
      "Pirkimų istorija",
      "Pilna pirkimų istorija bus atidaroma atskirame ekrane."
    );
  };

  const handleTickets = async () => {
    await mediumHaptic();
    Alert.alert(
      "Bilietai",
      "Čia bus viešojo transporto, traukinių ir airport pass bilietai."
    );
  };

  const handleRefunds = async () => {
    await mediumHaptic();
    Alert.alert(
      "Refunds / pagalba",
      "Čia vėliau prijungsime apmokėjimų pagalbą ir refund užklausas."
    );
  };

  const handleSetApplePay = async () => {
    await mediumHaptic();
    setDefaultPaymentMethod("Apple Pay");
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.defaultPaymentMethod,
        "Apple Pay"
      );
    } catch {}
  };

  const handleSetCard = async () => {
    await mediumHaptic();
    setDefaultPaymentMethod("Kortelė •••• 4242");
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.defaultPaymentMethod,
        "Kortelė •••• 4242"
      );
    } catch {}
  };

  const handleDemoBalanceTopUp = async () => {
    await mediumHaptic();

    const nextBalance = "€10.00";
    setWalletBalance(nextBalance);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.walletBalance, nextBalance);
    } catch {}

    Alert.alert("Demo top-up", "Wallet papildytas demo režimu iki €10.00");
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

          <Text style={styles.screenTitle}>Wallet</Text>

          <UltraPressable
            onPress={async () => {
              await tapHaptic();
              router.push("/menu");
            }}
          >
            <GlassCard style={styles.topIconButton}>
              <Ionicons name="grid-outline" size={20} color="#F8FBFF" />
            </GlassCard>
          </UltraPressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <GlassCard style={styles.walletHero}>
            <View style={styles.heroGlow} />

            <View style={styles.walletHeroTop}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials || "A"}</Text>
              </View>

              <View style={styles.walletHeroTextWrap}>
                <Text style={styles.walletHeroName}>{profileName}</Text>
                <Text style={styles.walletHeroEmail}>{profileEmail}</Text>

                <View style={styles.planBadgeRow}>
                  <View
                    style={[styles.planBadge, isPro && styles.planBadgeActive]}
                  >
                    <MaterialCommunityIcons
                      name="crown-outline"
                      size={13}
                      color={isPro ? "#0B1324" : "#F8D66D"}
                    />
                    <Text
                      style={[
                        styles.planBadgeText,
                        isPro && styles.planBadgeTextActive,
                      ]}
                    >
                      {isPro ? "PRO ACTIVE" : "FREE PLAN"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Wallet balansas</Text>
              <Text style={styles.balanceValue}>{walletBalance}</Text>
              <Text style={styles.balanceSubtext}>
                Future bilietai, credits ir transport purchases
              </Text>
            </View>

            <View style={styles.heroActionsRow}>
              <UltraPressable
                onPress={handleTopUp}
                style={styles.heroActionPressable}
              >
                <View style={styles.heroActionChipPrimary}>
                  <MaterialCommunityIcons
                    name="wallet-plus-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.heroActionTextPrimary}>Papildyti</Text>
                </View>
              </UltraPressable>

              <UltraPressable
                onPress={handleManagePro}
                style={styles.heroActionPressable}
              >
                <View style={styles.heroActionChip}>
                  <MaterialCommunityIcons
                    name="crown-outline"
                    size={18}
                    color="#EAF2FF"
                  />
                  <Text style={styles.heroActionText}>PRO</Text>
                </View>
              </UltraPressable>
            </View>
          </GlassCard>

          <SectionTitle title="Quick actions" />

          <GlassCard style={styles.sectionCard}>
            <View style={styles.quickActionsRow}>
              <UltraPressable
                onPress={handleTopUp}
                style={styles.quickActionPressable}
              >
                <View style={styles.quickActionTile}>
                  <View style={styles.quickActionIconWrap}>
                    <MaterialCommunityIcons
                      name="wallet-plus-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.quickActionTitle}>Top up</Text>
                  <Text style={styles.quickActionSubtitle}>
                    Papildyti balansą
                  </Text>
                </View>
              </UltraPressable>

              <UltraPressable
                onPress={handlePaymentMethods}
                style={styles.quickActionPressable}
              >
                <View style={styles.quickActionTile}>
                  <View style={styles.quickActionIconWrapAlt}>
                    <MaterialCommunityIcons
                      name="credit-card-outline"
                      size={20}
                      color="#EAF2FF"
                    />
                  </View>
                  <Text style={styles.quickActionTitle}>Cards</Text>
                  <Text style={styles.quickActionSubtitle}>
                    Mokėjimo metodai
                  </Text>
                </View>
              </UltraPressable>
            </View>

            <View style={styles.quickActionsRow}>
              <UltraPressable
                onPress={handleTickets}
                style={styles.quickActionPressable}
              >
                <View style={styles.quickActionTile}>
                  <View style={styles.quickActionIconWrapAlt}>
                    <MaterialCommunityIcons
                      name="ticket-confirmation-outline"
                      size={20}
                      color="#EAF2FF"
                    />
                  </View>
                  <Text style={styles.quickActionTitle}>Tickets</Text>
                  <Text style={styles.quickActionSubtitle}>Bilietai</Text>
                </View>
              </UltraPressable>

              <UltraPressable
                onPress={handlePurchaseHistory}
                style={styles.quickActionPressable}
              >
                <View style={styles.quickActionTile}>
                  <View style={styles.quickActionIconWrapAlt}>
                    <MaterialCommunityIcons
                      name="receipt-text-outline"
                      size={20}
                      color="#EAF2FF"
                    />
                  </View>
                  <Text style={styles.quickActionTitle}>History</Text>
                  <Text style={styles.quickActionSubtitle}>
                    Pirkimų istorija
                  </Text>
                </View>
              </UltraPressable>
            </View>
          </GlassCard>

          <SectionTitle title="Payments" />

          <GlassCard style={styles.sectionCard}>
            <WalletRow
              icon="credit-card-outline"
              title="Mokėjimo metodai"
              subtitle="Apple Pay, kortelės ir ateityje wallet integracija"
              value={defaultPaymentMethod}
              onPress={handlePaymentMethods}
            />
            <View style={styles.rowDivider} />

            <WalletRow
              icon="wallet-outline"
              title="Wallet papildymas"
              subtitle="Papildyk balansą greitesniems atsiskaitymams"
              badge="SOON"
              onPress={handleTopUp}
            />
            <View style={styles.rowDivider} />

            <WalletRow
              icon="ticket-confirmation-outline"
              title="Bilietai ir credits"
              subtitle="Viešojo transporto, train ir airport pass bilietai"
              badge="SOON"
              onPress={handleTickets}
            />
          </GlassCard>

          <SectionTitle title="Default payment" />

          <GlassCard style={styles.sectionCard}>
            <UltraPressable onPress={handleSetApplePay}>
              <View style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodLeft}>
                  <View style={styles.paymentMethodIconWrap}>
                    <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                  </View>

                  <View style={styles.paymentMethodTextWrap}>
                    <Text style={styles.paymentMethodTitle}>Apple Pay</Text>
                    <Text style={styles.paymentMethodSubtitle}>
                      Greičiausias atsiskaitymas iPhone naudotojams
                    </Text>
                  </View>
                </View>

                {defaultPaymentMethod === "Apple Pay" ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color="#60A5FA"
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#8EA6CC"
                  />
                )}
              </View>
            </UltraPressable>

            <View style={styles.rowDivider} />

            <UltraPressable onPress={handleSetCard}>
              <View style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodLeft}>
                  <View style={styles.paymentMethodIconWrapAlt}>
                    <MaterialCommunityIcons
                      name="credit-card-outline"
                      size={20}
                      color="#EAF2FF"
                    />
                  </View>

                  <View style={styles.paymentMethodTextWrap}>
                    <Text style={styles.paymentMethodTitle}>
                      Kortelė •••• 4242
                    </Text>
                    <Text style={styles.paymentMethodSubtitle}>
                      Atsarginis arba numatytasis kortelės metodas
                    </Text>
                  </View>
                </View>

                {defaultPaymentMethod === "Kortelė •••• 4242" ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color="#60A5FA"
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#8EA6CC"
                  />
                )}
              </View>
            </UltraPressable>
          </GlassCard>

          <SectionTitle title="Purchase history" />

          <GlassCard style={styles.sectionCard}>
            {purchaseHistory.map((item, index) => (
              <View key={item.id}>
                <PurchaseHistoryItem item={item} />
                {index < purchaseHistory.length - 1 ? (
                  <View style={styles.rowDivider} />
                ) : null}
              </View>
            ))}
          </GlassCard>

          <SectionTitle title="Support" />

          <GlassCard style={styles.sectionCard}>
            <WalletRow
              icon="lifebuoy"
              title="Apmokėjimų pagalba"
              subtitle="Support dėl mokėjimų, top-up ir prenumeratų"
              onPress={handleRefunds}
            />
            <View style={styles.rowDivider} />

            <WalletRow
              icon="cash-refund"
              title="Refund užklausa"
              subtitle="Grąžinimai ir neteisingi nuskaitymai"
              badge="SOON"
              onPress={handleRefunds}
            />
            <View style={styles.rowDivider} />

            <WalletRow
              icon="flask-outline"
              title="Demo top-up"
              subtitle="Papildyti balansą demo režimu"
              value="+€10"
              onPress={handleDemoBalanceTopUp}
            />
          </GlassCard>

          <View style={styles.footerSpace} />
        </ScrollView>

        <BottomTabBar activeTab="wallet" />
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

  walletHero: {
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

  walletHeroTop: {
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

  walletHeroTextWrap: {
    flex: 1,
  },

  walletHeroName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },

  walletHeroEmail: {
    color: "#AFC3E6",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },

  planBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.28)",
  },

  planBadgeActive: {
    backgroundColor: "#F8D66D",
    borderColor: "#F8D66D",
  },

  planBadgeText: {
    color: "#F8D66D",
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 5,
  },

  planBadgeTextActive: {
    color: "#0B1324",
  },

  balanceCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 14,
  },

  balanceLabel: {
    color: "#8CCBFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  balanceValue: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginBottom: 4,
  },

  balanceSubtext: {
    color: "#AFC3E6",
    fontSize: 13,
    fontWeight: "700",
  },

  heroActionsRow: {
    flexDirection: "row",
  },

  heroActionPressable: {
    flex: 1,
    marginRight: 8,
  },

  heroActionChipPrimary: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A86F7",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  heroActionChip: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  heroActionTextPrimary: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
  },

  heroActionText: {
    color: "#EAF2FF",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 8,
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

  quickActionsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },

  quickActionPressable: {
    flex: 1,
    marginRight: 8,
    marginBottom: 8,
  },

  quickActionTile: {
    minHeight: 116,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    justifyContent: "space-between",
  },

  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4A86F7",
  },

  quickActionIconWrapAlt: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  quickActionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 14,
  },

  quickActionSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 4,
  },

  walletRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  walletRowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 12,
  },

  walletRowIconWrapDanger: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },

  walletRowTextWrap: {
    flex: 1,
  },

  walletRowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },

  walletRowTitle: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "900",
  },

  walletRowTitleDanger: {
    color: "#FCA5A5",
  },

  walletRowSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    paddingRight: 8,
  },

  walletRowValue: {
    color: "#D8E4F5",
    fontSize: 12,
    fontWeight: "800",
    marginRight: 8,
    marginLeft: 8,
  },

  paymentMethodCard: {
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },

  paymentMethodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    marginRight: 12,
  },

  paymentMethodIconWrapAlt: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginRight: 12,
  },

  paymentMethodTextWrap: {
    flex: 1,
  },

  paymentMethodTitle: {
    color: "#F8FBFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },

  paymentMethodSubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  historyRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 12,
  },

  historyTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  historyTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    flexWrap: "wrap",
  },

  historyTitle: {
    color: "#F8FBFF",
    fontSize: 14,
    fontWeight: "900",
    marginRight: 8,
  },

  historySubtitle: {
    color: "#8EA6CC",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  historyAmount: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.16)",
  },

  historyStatusText: {
    color: "#8ED8FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
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