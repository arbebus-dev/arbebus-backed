import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  type FavoritePlace,
  getFavoritePlaces,
  removeFavoritePlace,
} from "@/core/services/favorites/favoritePlacesService";

export default function FavoritePlacesSheet({
  visible,
  onClose,
  onSelectPlace,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectPlace: (place: FavoritePlace) => void;
}) {
  const [places, setPlaces] = useState<FavoritePlace[]>([]);

  useEffect(() => {
    if (!visible) return;
    void getFavoritePlaces().then(setPlaces);
  }, [visible]);

  const deletePlace = async (id: string) => {
    void Haptics.selectionAsync();
    const next = await removeFavoritePlace(id);
    setPlaces(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.roundButton} hitSlop={12}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.title}>Mėgstamos vietos</Text>
            <View style={styles.roundButtonGhost} />
          </View>

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="heart-plus" size={22} color="#34F5A2" />
            <Text style={styles.infoText}>
              Vietas išsaugok paieškoje paspaudęs širdelę prie pasirinktos vietos.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {places.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="heart-outline" size={48} color="rgba(255,255,255,0.34)" />
                <Text style={styles.emptyTitle}>Dar nėra išsaugotų vietų</Text>
                <Text style={styles.emptyText}>
                  Ieškok vietos, paspausk širdelę ir ji atsiras čia.
                </Text>
              </View>
            ) : (
              places.map((place) => (
                <Pressable
                  key={place.id}
                  style={styles.placeRow}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onSelectPlace(place);
                  }}
                >
                  <View style={styles.placeIcon}>
                    <Ionicons name="location" size={20} color="#34F5A2" />
                  </View>
                  <View style={styles.placeTextBlock}>
                    <Text style={styles.placeTitle} numberOfLines={1}>{place.title}</Text>
                    <Text style={styles.placeSubtitle} numberOfLines={1}>{place.subtitle || "Klaipėda"}</Text>
                  </View>
                  <Pressable onPress={() => deletePlace(place.id)} style={styles.deleteButton} hitSlop={10}>
                    <Ionicons name="trash-outline" size={21} color="rgba(255,255,255,0.52)" />
                  </Pressable>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    minHeight: "72%",
    maxHeight: "88%",
    backgroundColor: "#071017",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: "rgba(52,245,162,0.18)",
  },
  handle: {
    alignSelf: "center",
    width: 70,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginBottom: 18,
  },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  roundButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  roundButtonGhost: { width: 50, height: 50 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(52,245,162,0.09)",
    borderWidth: 1,
    borderColor: "rgba(52,245,162,0.16)",
    marginBottom: 14,
  },
  infoText: {
    flex: 1,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  listContent: { paddingBottom: 24 },
  emptyState: {
    alignItems: "center",
    paddingTop: 70,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },
  placeRow: {
    minHeight: 78,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,245,162,0.14)",
    marginRight: 12,
  },
  placeTextBlock: { flex: 1 },
  placeTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  placeSubtitle: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  deleteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
