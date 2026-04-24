import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../core/auth/useAuth";

function ActionRow({ title, subtitle, icon, onPress }: { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}><Ionicons name={icon} size={20} color="#111827" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </Pressable>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const { user, isGuest, continueAsGuest, signOut } = useAuth();

  const userName = user?.fullName || "Guest";
  const userEmail = user?.email || "guest@arbebus.app";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ARBEBUS ACCOUNT</Text>
          <Text style={styles.title}>{userName}</Text>
          <Text style={styles.subtitle}>{userEmail}</Text>
        </View>

        <View style={styles.card}>
          <ActionRow title="Profile" subtitle="Paskyros informacija" icon="person-outline" onPress={() => router.push('/profile')} />
          <View style={styles.divider} />
          <ActionRow title="Saved places" subtitle="Namai, darbas ir mėgstamos vietos" icon="bookmark-outline" onPress={() => Alert.alert('Saved places', 'Šis ekranas bus prijungtas kitame etape.')} />
          <View style={styles.divider} />
          <ActionRow title="Notifications" subtitle="Kelionių priminimai" icon="notifications-outline" onPress={() => Alert.alert('Notifications', 'Ši funkcija bus prijungta kitame etape.')} />
        </View>

        <View style={styles.card}>
          {isGuest ? (
            <ActionRow title="Continue as guest" subtitle="Laikinas režimas be paskyros" icon="sparkles-outline" onPress={() => continueAsGuest().catch(() => Alert.alert('Guest mode', 'Nepavyko tęsti kaip svečiui.'))} />
          ) : (
            <ActionRow title="Sign out" subtitle="Atsijungti iš Arbebus" icon="log-out-outline" onPress={() => signOut().catch(() => Alert.alert('Sign out', 'Nepavyko atsijungti.'))} />
          )}
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
