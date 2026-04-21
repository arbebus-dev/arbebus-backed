import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FLOATING_TAB_BAR_SPACE = 120;

type QuickTicket = {
  id: string;
  title: string;
  subtitle: string;
};

const quickTickets: QuickTicket[] = [
  {
    id: "1",
    title: "Single ticket",
    subtitle: "2 adults, zone 1, 2Ø, 3Ø, and 4N",
  },
  {
    id: "2",
    title: "Single ticket",
    subtitle: "2 adults, zone 2Ø, 3Ø, and 4N",
  },
];

export default function TicketsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>Tickets</Text>

            <Pressable style={styles.iconButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#F8FAFC" />
            </Pressable>
          </View>

          <View style={styles.emptyCard}>
            <View style={styles.emptyIllustration}>
              <Text style={styles.emptyEmoji}>🧐</Text>
            </View>

            <Text style={styles.emptyTitle}>You have no tickets</Text>
          </View>

          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Buy ticket</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick purchase</Text>
            <Pressable hitSlop={10}>
              <Text style={styles.sectionAction}>See all</Text>
            </Pressable>
          </View>

          <View style={styles.cardsColumn}>
            {quickTickets.map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketTextWrap}>
                  <Text style={styles.ticketTitle}>{ticket.title}</Text>
                  <Text style={styles.ticketSubtitle}>{ticket.subtitle}</Text>
                </View>

                <Pressable style={styles.buyChip}>
                  <Text style={styles.buyChipText}>Buy</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable style={styles.loginPromptCard}>
            <View style={styles.loginPromptLeft}>
              <View style={styles.loginPromptIconWrap}>
                <Ionicons name="happy-outline" size={20} color="#F8FAFC" />
              </View>

              <Text style={styles.loginPromptText}>
                Keep your tickets safe with a personal profile
              </Text>
            </View>

            <Text style={styles.loginPromptAction}>Log in</Text>
          </Pressable>
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
    paddingTop: 12,
    paddingBottom: FLOATING_TAB_BAR_SPACE + 36,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  screenTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyIllustration: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyEmoji: {
    fontSize: 38,
  },

  emptyTitle: {
    color: "#D8E0F0",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  primaryButton: {
    height: 62,
    borderRadius: 22,
    backgroundColor: "#2B3140",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },

  primaryButtonText: {
    color: "#6E94FF",
    fontSize: 18,
    fontWeight: "800",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#E5EAF4",
    fontSize: 18,
    fontWeight: "800",
  },

  sectionAction: {
    color: "#6E94FF",
    fontSize: 16,
    fontWeight: "800",
  },

  cardsColumn: {
    gap: 12,
    marginBottom: 18,
  },

  ticketCard: {
    borderRadius: 24,
    backgroundColor: "#232936",
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  ticketTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  ticketTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },

  ticketSubtitle: {
    color: "#AAB3C5",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },

  buyChip: {
    minWidth: 84,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#5E86FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  buyChipText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  loginPromptCard: {
    borderRadius: 24,
    backgroundColor: "#2B3556",
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  loginPromptLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  loginPromptIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  loginPromptText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },

  loginPromptAction: {
    color: "#6E94FF",
    fontSize: 17,
    fontWeight: "800",
  },
});