import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ActionItem = {
  id: string;
  title: string;
  subtitle: string;
  icon:
    | keyof typeof Ionicons.glyphMap
    | keyof typeof MaterialCommunityIcons.glyphMap;
  library: "ion" | "mdi";
  accent?: string;
  onPress: () => void;
};

function ActionCard({ item }: { item: ActionItem }) {
  const color = item.accent || "#8ED8FF";

  return (
    <Pressable style={styles.card} onPress={item.onPress}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}16` }]}>
        {item.library === "mdi" ? (
          <MaterialCommunityIcons
            name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={20}
            color={color}
          />
        ) : (
          <Ionicons
            name={item.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={color}
          />
        )}
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
    </Pressable>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();

  const tap = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  const medium = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const showSoon = async (title: string) => {
    await medium();
    Alert.alert(title, "Ši funkcija bus prijungta kitame etape.");
  };

  const actions: ActionItem[] = [
    {
      id: "methods",
      title: "Payment methods",
      subtitle: "Kortelės ir būsimas Apple Pay",
      icon: "card-outline",
      library: "ion",
      accent: "#60A5FA",
      onPress: async () => {
        await tap();
        router.push("/payment-methods");
      },
    },
    {
      id: "history",
      title: "Billing history",
      subtitle: "Mokėjimų istorija ir kvitai",
      icon: "receipt-text-outline",
      library: "mdi",
      accent: "#A78BFA",
      onPress: async () => showSoon("Billing history"),
    },
    {
      id: "pro",
      title: "Arbebus PRO",
      subtitle: "Prenumerata bus prijungta vėliau",
      icon: "diamond-outline",
      library: "mdi",
      accent: "#34D399",
      onPress: async () => showSoon("Arbebus PRO"),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />

            <Text style={styles.eyebrow}>ARBEBUS WALLET</Text>
            <Text style={styles.heroTitle}>Wallet</Text>
            <Text style={styles.heroSubtitle}>
              Stabilus wallet ekranas be RevenueCat crash. Vėliau prijungsime
              realius mokėjimus.
            </Text>

            <View style={styles.metricRow}>
              <Metric label="Plan" value="Free" />
              <Metric label="Status" value="Ready" />
            </View>
          </View>

          <View style={styles.grid}>
            {actions.map((item) => (
              <ActionCard key={item.id} item={item} />
            ))}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#07101D",
  },
  container: {
    flex: 1,
    backgroundColor: "#07101D",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginBottom: 16,
  },
  heroGlow: {
    position: "absolute",
    top: -18,
    left: 30,
    right: 30,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(71,182,255,0.08)",
  },
  eyebrow: {
    color: "#8FB7FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#AFC3E6",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  metricRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  metricLabel: {
    color: "#8FA5C7",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  grid: {
    gap: 12,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardSubtitle: {
    color: "#AFC3E6",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
});