import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useParentDashboard } from "../hooks/useParentDashboard";
import type { TripEvent } from "../services/parentApi";

export default function ParentDashboardScreen() {
  const { dashboard, loading, error, refresh } = useParentDashboard();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    >
      <Text style={styles.title}>Tėvų skydelis</Text>
      <Text style={styles.subtitle}>
        Vaiko kelionės, išsaugotos vietos ir įvykiai.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.grid}>
        <InfoCard title="Vaikai" value={dashboard?.children?.length || 0} />
        <InfoCard title="Vietos" value={dashboard?.savedPlaces?.length || 0} />
        <InfoCard
          title="Aktyvios kelionės"
          value={dashboard?.activeTrips?.length || 0}
        />
      </View>
      <Text style={styles.section}>Paskutiniai įvykiai</Text>
      {(dashboard?.recentEvents || []).slice(0, 8).map((event: TripEvent) => (
        <View key={event.id} style={styles.event}>
          <Text style={styles.eventTitle}>
            {event.title || event.event_type || event.type}
          </Text>
          <Text style={styles.eventTime}>
            {event.created_at || event.createdAt}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function InfoCard({ title, value }: { title: string; value: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070A" },
  content: { padding: 20, paddingTop: 70, gap: 14 },
  title: { color: "white", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.62)", fontSize: 14 },
  error: { color: "#FCA5A5", fontSize: 13 },
  grid: { flexDirection: "row", gap: 10 },
  card: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 14,
  },
  value: { color: "white", fontSize: 24, fontWeight: "800" },
  cardTitle: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 3 },
  section: { color: "white", fontSize: 16, fontWeight: "700", marginTop: 10 },
  event: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: 12,
  },
  eventTitle: { color: "white", fontSize: 14, fontWeight: "600" },
  eventTime: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
});
