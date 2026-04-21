import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

export default function PaymentMethodsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Payment methods</Text>

        <View style={styles.headerButtonPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>Checkout ready</Text>
              <Text style={styles.heroTitle}>Your payment setup</Text>
            </View>

            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons
                name="credit-card-check-outline"
                size={24}
                color="#8AB4FF"
              />
            </View>
          </View>

          <Text style={styles.heroSubtitle}>
            Add a card for faster wallet top ups, ride payments and ticket
            purchases.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved methods</Text>

          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="card-outline" size={24} color="#DCE7FF" />
            </View>

            <Text style={styles.emptyTitle}>No payment methods yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first card to unlock faster checkout across Arbebus.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                Alert.alert("Add card", "Add card flow coming next.")
              }
            >
              <Text style={styles.primaryButtonText}>Add new card</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supported</Text>

          <View style={styles.supportList}>
            <View style={styles.supportRow}>
              <MaterialCommunityIcons
                name="credit-card-outline"
                size={20}
                color="#9FB7FF"
              />
              <Text style={styles.supportText}>Visa & Mastercard</Text>
            </View>

            <View style={styles.supportRow}>
              <Ionicons name="phone-portrait-outline" size={20} color="#9FB7FF" />
              <Text style={styles.supportText}>Apple Pay / Google Pay</Text>
            </View>

            <View style={styles.supportRow}>
              <MaterialCommunityIcons
                name="wallet-outline"
                size={20}
                color="#9FB7FF"
              />
              <Text style={styles.supportText}>Wallet top ups</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  headerButtonPlaceholder: {
    width: 42,
    height: 42,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  content: {
    padding: 16,
    paddingBottom: 140,
  },

  heroCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#081C3C",
    borderWidth: 1,
    borderColor: "rgba(126,161,255,0.16)",
    marginBottom: 16,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  heroEyebrow: {
    color: "#8EA4C8",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },

  heroSubtitle: {
    color: "#AFC3E6",
    fontSize: 14,
    lineHeight: 20,
  },

  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  section: {
    marginBottom: 16,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },

  emptyCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "flex-start",
  },

  emptyIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 14,
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },

  emptySubtitle: {
    color: "#8EA4C8",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  primaryButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#3167E3",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  supportList: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },

  supportText: {
    color: "#E5ECF9",
    fontSize: 15,
    fontWeight: "600",
  },
});