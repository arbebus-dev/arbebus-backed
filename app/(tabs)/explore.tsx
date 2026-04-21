import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FLOATING_TAB_BAR_SPACE = 120;

type MenuItem = {
  id: string;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  external?: boolean;
};

const paymentItems: MenuItem[] = [
  {
    id: "purchase-history",
    title: "Purchase history",
    icon: "receipt-text-outline",
  },
  {
    id: "claim-ticket",
    title: "Claim ticket",
    icon: "cellphone-arrow-down",
  },
  {
    id: "payment-methods",
    title: "Payment methods",
    icon: "credit-card-outline",
  },
];

const journeyItems: MenuItem[] = [
  {
    id: "accessibility",
    title: "Accessibility",
    icon: "human-handsup",
  },
  {
    id: "favourites",
    title: "Favourites",
    icon: "star-outline",
  },
];

const supportItems: MenuItem[] = [
  {
    id: "contact-us",
    title: "Contact us",
    icon: "message-text-outline",
  },
  {
    id: "terms",
    title: "Terms and privacy",
    icon: "file-document-outline",
  },
  {
    id: "accessibility-statement",
    title: "Accessibility statement",
    icon: "link-variant",
    external: true,
  },
];

function MenuCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.menuCard}>{children}</View>;
}

function MenuRow({ item }: { item: MenuItem }) {
  const handlePress = () => {
    if (item.external) {
      Linking.openURL("https://example.com").catch(() => {});
    }
  };

  return (
    <Pressable style={styles.menuRow} onPress={handlePress}>
      <View style={styles.menuRowLeft}>
        <View style={styles.menuIconWrap}>
          <MaterialCommunityIcons
            name={item.icon}
            size={22}
            color="#6E94FF"
          />
        </View>

        <Text style={styles.menuRowTitle}>{item.title}</Text>
      </View>

      <Ionicons
        name={item.external ? "open-outline" : "chevron-forward"}
        size={18}
        color="#8C97AD"
      />
    </Pressable>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: MenuItem[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <MenuCard>
        {items.map((item, index) => (
          <View key={item.id}>
            <MenuRow item={item} />
            {index < items.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </MenuCard>
    </View>
  );
}

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.screenTitle}>Profile</Text>

          <Pressable style={styles.loginHero}>
            <View style={styles.loginHeroTextWrap}>
              <Text style={styles.loginHeroTitle}>
                Psst! You are not logged in
              </Text>
              <Text style={styles.loginHeroSubtitle}>
                Log in or create a profile, and we&apos;ll always take care of
                your tickets
              </Text>
            </View>

            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={18} color="#8C97AD" />
            </View>
          </Pressable>

          <MenuCard>
            <MenuRow
              item={{
                id: "settings",
                title: "Settings",
                icon: "cog",
              }}
            />
          </MenuCard>

          <Section title="Tickets and payment" items={paymentItems} />
          <Section title="Your journeys" items={journeyItems} />
          <Section title="Support" items={supportItems} />

          <Pressable style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Log in or sign up</Text>
          </Pressable>

          <Text style={styles.versionText}>Version: 16.13.0 (8426)</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0F18",
  },

  container: {
    flex: 1,
    backgroundColor: "#0B0F18",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: FLOATING_TAB_BAR_SPACE + 44,
  },

  screenTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginBottom: 20,
  },

  loginHero: {
    borderRadius: 28,
    backgroundColor: "#232733",
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    minHeight: 108,
  },

  loginHeroTextWrap: {
    flex: 1,
    paddingRight: 14,
  },

  loginHeroTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },

  loginHeroSubtitle: {
    color: "#A7B0C2",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },

  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  section: {
    marginTop: 18,
  },

  sectionTitle: {
    color: "#B8C0D1",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },

  menuCard: {
    borderRadius: 28,
    backgroundColor: "#232733",
    overflow: "hidden",
  },

  menuRow: {
    minHeight: 72,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  menuRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
  },

  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  menuRowTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },

  divider: {
    marginLeft: 64,
    marginRight: 18,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  loginButton: {
    marginTop: 30,
    height: 64,
    borderRadius: 26,
    backgroundColor: "#6A8CFF",
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  versionText: {
    marginTop: 28,
    textAlign: "center",
    color: "#8C94A8",
    fontSize: 15,
    fontWeight: "500",
  },
});