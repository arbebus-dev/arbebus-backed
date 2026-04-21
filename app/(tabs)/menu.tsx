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

type MenuItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon:
    | keyof typeof Ionicons.glyphMap
    | keyof typeof MaterialCommunityIcons.glyphMap;
  library: "ion" | "mdi";
  accent?: string;
  onPress: () => void;
};

function AppIcon({ item }: { item: MenuItem }) {
  const color = item.accent || "#8ED8FF";

  if (item.library === "mdi") {
    return (
      <MaterialCommunityIcons
        name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={20}
        color={color}
      />
    );
  }

  return (
    <Ionicons
      name={item.icon as keyof typeof Ionicons.glyphMap}
      size={20}
      color={color}
    />
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <Pressable style={styles.row} onPress={item.onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <AppIcon item={item} />
        </View>

        <View style={styles.rowTextWrap}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          {!!item.subtitle && (
            <Text style={styles.rowSubtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#8FA5C7" />
    </Pressable>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function MenuScreen() {
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

  const mainItems: MenuItem[] = [
    {
      id: "profile",
      title: "Profile",
      subtitle: "Prisijungimas ir paskyros valdymas",
      icon: "person-circle-outline",
      library: "ion",
      accent: "#60A5FA",
      onPress: async () => {
        await tap();
        router.push("/profile");
      },
    },
    {
      id: "saved",
      title: "Saved places",
      subtitle: "Namai, darbas ir dažnos vietos",
      icon: "bookmark-outline",
      library: "ion",
      accent: "#A78BFA",
      onPress: async () => showSoon("Saved places"),
    },
    {
      id: "notifications",
      title: "Notifications",
      subtitle: "Kelionės priminimai ir būsimi alertai",
      icon: "notifications-outline",
      library: "ion",
      accent: "#F59E0B",
      onPress: async () => showSoon("Notifications"),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      id: "tickets",
      title: "My tickets",
      subtitle: "Bilietų ir pirkimų peržiūra",
      icon: "ticket-confirmation-outline",
      library: "mdi",
      accent: "#34D399",
      onPress: async () => {
        await tap();
        router.push("/buses");
      },
    },
    {
      id: "payments",
      title: "Payment methods",
      subtitle: "Mokėjimų metodai ir ateities Apple Pay",
      icon: "card-outline",
      library: "ion",
      accent: "#8B5CF6",
      onPress: async () => {
        await tap();
        router.push("/payment-methods");
      },
    },
    {
      id: "help",
      title: "Help & support",
      subtitle: "Pagalba ir kontaktai",
      icon: "help-circle-outline",
      library: "ion",
      accent: "#22C55E",
      onPress: async () => showSoon("Help & support"),
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
            <Text style={styles.eyebrow}>ARBEBUS MENU</Text>
            <Text style={styles.heroTitle}>Menu</Text>
            <Text style={styles.heroSubtitle}>
              Stabilus variantas be crash. Čia laikysime profilį, nustatymus ir
              kitus app valdymo veiksmus.
            </Text>
          </View>

          <Section title="Account">
            {mainItems.map((item, index) => (
              <View key={item.id}>
                <MenuRow item={item} />
                {index < mainItems.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Section>

          <Section title="Support">
            {supportItems.map((item, index) => (
              <View key={item.id}>
                <MenuRow item={item} />
                {index < supportItems.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Section>

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
  section: {
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  sectionCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  row: {
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  rowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginRight: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  rowSubtitle: {
    color: "#9FB1CC",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 68,
    marginRight: 14,
  },
});