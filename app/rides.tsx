import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ITEMS = [
  { id: 'upcoming', title: 'Upcoming rides', subtitle: 'Artimiausios kelionės ir planai', icon: 'time-outline' },
  { id: 'history', title: 'Ride history', subtitle: 'Ankstesnės kelionės ir jų detalės', icon: 'trail-sign-outline' },
  { id: 'tickets', title: 'Tickets', subtitle: 'Bilietai bus prijungti kitame etape', icon: 'ticket-outline' },
];

export default function RidesScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ARBEBUS RIDES</Text>
          <Text style={styles.title}>Your rides</Text>
          <Text style={styles.subtitle}>Čia laikysime kelionių istoriją, bilietus ir aktyvias keliones. Prenumeratos logika iš šio ekrano pašalinta.</Text>
        </View>
        <View style={styles.card}>
          {ITEMS.map((item, index) => (
            <React.Fragment key={item.id}>
              <Pressable style={styles.row} onPress={() => item.id === 'tickets' ? router.push('/buses') : Alert.alert(item.title, 'Šis ekranas bus prijungtas kitame etape.')}>
                <View style={styles.rowLeft}>
                  <View style={styles.iconWrap}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color="#111827" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>
              {index < ITEMS.length - 1 ? <View style={styles.divider} /> : null}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FB' },
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  hero: { borderRadius: 28, padding: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#64748B', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 6, fontSize: 15, color: '#475569', fontWeight: '600' },
  card: { borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  row: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  rowSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#EEF2F7', marginLeft: 74 },
});
