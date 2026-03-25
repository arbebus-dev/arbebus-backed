import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { buses } from "./buses";
import { stops } from "./stops";

export default function ExploreScreen() {
  const [location, setLocation] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selectedStop, setSelectedStop] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371e3;

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const getStopETA = (bus: any, stop: any) => {
    const current = bus.route[bus.index];
    const dx = stop.lat - current.lat;
    const dy = stop.lng - current.lng;

    const distance = Math.sqrt(dx * dx + dy * dy) * 111000;
    const speed = 8;
    const minutes = Math.round(distance / speed / 60);

    return minutes < 1 ? 1 : minutes;
  };

  const getArrivalsForStop = (stop: any) => {
    return buses
      .map((bus) => ({
        line: bus.line,
        eta: getStopETA(bus, stop),
        color: bus.color,
      }))
      .sort((a, b) => a.eta - b.eta);
  };

  const enrichedStops = useMemo(() => {
    return stops
      .map((stop) => ({
        ...stop,
        distance: location
          ? getDistance(
              location.latitude,
              location.longitude,
              stop.lat,
              stop.lng
            )
          : null,
      }))
      .filter((stop) =>
        stop.name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }, [location, search]);

  const nearestThreeStops = enrichedStops.slice(0, 3);

  const fastestArrivals = stops
    .flatMap((stop) =>
      getArrivalsForStop(stop).map((item) => ({
        stopName: stop.name,
        line: item.line,
        eta: item.eta,
        color: item.color,
      }))
    )
    .sort((a, b) => a.eta - b.eta)
    .slice(0, 3);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Stotelės</Text>

      <TextInput
        placeholder="Ieškoti stotelės..."
        placeholderTextColor="#94a3b8"
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />

      <View style={styles.fastestSection}>
        <Text style={styles.fastestTitle}>Greičiausi atvykimai</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {fastestArrivals.map((item, index) => (
            <View
              key={item.line + item.stopName + index}
              style={[
                styles.fastestCard,
                {
                  borderColor: item.color,
                  backgroundColor: item.color + "22",
                },
              ]}
            >
              <Text style={[styles.fastestLine, { color: item.color }]}>
                {item.line} autobusas
              </Text>
              <Text style={styles.fastestStop}>{item.stopName}</Text>
              <Text style={styles.fastestEta}>{item.eta} min</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.quickSection}>
        <Text style={styles.quickTitle}>Artimiausios stotelės</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {nearestThreeStops.map((stop) => (
            <Pressable
              key={stop.id}
              style={styles.quickCard}
              onPress={() => setSelectedStop(stop)}
            >
              <Text style={styles.quickCardName}>{stop.name}</Text>
              {stop.distance !== null && (
                <Text style={styles.quickCardDistance}>{stop.distance} m</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {enrichedStops.map((stop) => (
          <Pressable
            key={stop.id}
            style={styles.stopCard}
            onPress={() => setSelectedStop(stop)}
          >
            <View style={styles.stopRowTop}>
              <Text style={styles.stopName}>{stop.name}</Text>
              {stop.distance !== null && (
                <Text style={styles.stopDistance}>{stop.distance} m</Text>
              )}
            </View>

            <View style={styles.arrivalsPreview}>
              {getArrivalsForStop(stop)
                .slice(0, 2)
                .map((item) => (
                  <View
                    key={item.line}
                    style={[
                      styles.arrivalBadge,
                      {
                        backgroundColor: item.color + "22",
                        borderColor: item.color,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.arrivalBadgeText, { color: item.color }]}
                    >
                      {item.line} · {item.eta} min
                    </Text>
                  </View>
                ))}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {selectedStop && (
        <View style={styles.detailsBox}>
          <Text style={styles.detailsTitle}>{selectedStop.name}</Text>
          <Text style={styles.detailsSubtitle}>Artimiausi atvykimai</Text>

          {getArrivalsForStop(selectedStop).map((item) => (
            <View style={styles.detailsRow}>
  <View
    style={[
      styles.detailsBadge,
      {
        backgroundColor: item.color + "22",
        borderColor: item.color,
      },
    ]}
  >
    <Text style={[styles.detailsBadgeText, { color: item.color }]}>
      {item.line}
    </Text>
  </View>

  <Text style={styles.detailsLine}>autobusas</Text>

  <Text style={[styles.detailsEta, { color: item.color }]}>
    {item.eta} min
  </Text>
</View>
          ))}

          <Pressable
            style={styles.closeButton}
            onPress={() => setSelectedStop(null)}
          >
            <Text style={styles.closeButtonText}>Uždaryti</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 14,
  },
  searchInput: {
    backgroundColor: "#1e293b",
    color: "white",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },

  fastestSection: {
    marginBottom: 16,
  },
  fastestTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  fastestCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 10,
    minWidth: 170,
  },
  fastestLine: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  fastestStop: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  fastestEta: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
  },

  quickSection: {
    marginBottom: 14,
  },
  quickTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  quickCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 10,
    minWidth: 150,
  },
  quickCardName: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  quickCardDistance: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "700",
  },

  listContent: {
    paddingBottom: 140,
  },
  stopCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  stopRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stopName: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  stopDistance: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "700",
  },
  arrivalsPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  arrivalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  arrivalBadgeText: {
    fontWeight: "700",
    fontSize: 13,
  },
detailsBadge: {
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 4,
  marginRight: 8,
},

detailsBadgeText: {
  fontWeight: "700",
  fontSize: 13,
},
  detailsBox: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  detailsTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  detailsSubtitle: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  detailsLine: {
    color: "white",
    fontSize: 15,
  },
  detailsEta: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "700",
  },
  closeButton: {
    marginTop: 14,
    backgroundColor: "#1d4ed8",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
  },
});