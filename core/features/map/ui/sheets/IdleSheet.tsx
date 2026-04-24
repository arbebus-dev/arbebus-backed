import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type FavoriteRoute = {
  id: string;
  fromLabel: string;
  toLabel: string;
};

const QUICK_CHIPS = [
  { label: "Centras", icon: "business-outline" as const },
  { label: "Stotis", icon: "train-outline" as const },
  { label: "Akropolis", icon: "storefront-outline" as const },
  { label: "Universitetas", icon: "school-outline" as const },
];

export default function IdleSheet({
  favorites,
  onPressFavorite,
}: {
  favorites: FavoriteRoute[];
  onPressFavorite: (item: FavoriteRoute) => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Apple Maps principas</Text>
        <Text style={styles.heroTitle}>Vienas ekranas visai kelionei</Text>
        <Text style={styles.heroText}>
          Paieška viršuje, gyvi autobusai žemėlapyje, o visa maršruto eiga su stotelėmis ir laikais – apatiniame sheet.
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}><Text style={styles.heroStatValue}>Live</Text><Text style={styles.heroStatLabel}>Autobusai</Text></View>
          <View style={styles.heroStat}><Text style={styles.heroStatValue}>ETA</Text><Text style={styles.heroStatLabel}>Atvykimas</Text></View>
          <View style={styles.heroStat}><Text style={styles.heroStatValue}>Stop-by-stop</Text><Text style={styles.heroStatLabel}>Kelionės eiga</Text></View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Greiti pasirinkimai</Text>
          <Text style={styles.sectionMeta}>Dažniausios kryptys</Text>
        </View>
        <View style={styles.quickGrid}>
          {QUICK_CHIPS.map((chip) => (
            <View key={chip.label} style={styles.quickCard}>
              <View style={styles.quickIcon}><Ionicons name={chip.icon} size={18} color="#0F172A" /></View>
              <Text style={styles.quickTitle}>{chip.label}</Text>
              <Text style={styles.quickSubtitle}>Atidaryti kaip kelionės tikslą</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mėgstami maršrutai</Text>
          <Text style={styles.sectionMeta}>{favorites.length}/8</Text>
        </View>
        {favorites.length ? (
          favorites.map((item) => (
            <Pressable key={item.id} onPress={() => onPressFavorite(item)} style={styles.favoriteCard}>
              <View style={styles.favoriteIcon}><Ionicons name="git-compare-outline" size={18} color="#1677FF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.favoriteTitle}>{item.fromLabel} → {item.toLabel}</Text>
                <Text style={styles.favoriteText}>Atkurk paiešką ir perskaičiuok kelionę vienu paspaudimu</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Kol kas nėra mėgstamų maršrutų</Text>
            <Text style={styles.emptyText}>
              Kai pasirinksi kelionę, galėsi ją išsisaugoti ir paleisti vėl be naujos paieškos.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    gap: 20,
  },
  heroCard: {
    backgroundColor: "#0F172A",
    borderRadius: 28,
    padding: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  heroKicker: {
    color: "#93C5FD",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: "#FFF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 6,
    letterSpacing: -0.4,
  },
  heroText: {
    color: "#CBD5E1",
    marginTop: 8,
    lineHeight: 20,
  },
  heroStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  heroStat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 12,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  heroStatLabel: {
    color: "#93C5FD",
    marginTop: 4,
    fontSize: 12,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },
  sectionMeta: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickCard: {
    width: "47%",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickTitle: {
    marginTop: 12,
    color: "#111827",
    fontWeight: "800",
  },
  quickSubtitle: {
    color: "#64748B",
    marginTop: 4,
    fontSize: 12,
  },
  favoriteCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  favoriteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteTitle: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  favoriteText: {
    color: "#64748B",
    lineHeight: 18,
  },
  emptyBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  emptyText: {
    color: "#64748B",
    lineHeight: 18,
  },
});
