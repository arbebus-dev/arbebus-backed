import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, typography } from "@/core/design";
import AccountCard from "../components/AccountCard";
import AccountListItem from "../components/AccountListItem";
import ProfileHeader from "../components/ProfileHeader";

type Props = { onBack: () => void };

function Header({ onBack }: Props) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={14} style={styles.backButton}>
        <Ionicons name="chevron-back" size={21} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Profilis</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

export default function ProfileScreen({ onBack }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.glow} />
        <Header onBack={onBack} />
        <ProfileHeader />

        <Section title="ASMENINĖ INFORMACIJA" />
        <AccountCard>
          <AccountListItem
            title="Vardas"
            value="Vardas"
            isLast={false}
            onPress={() => {}}
          />
          <AccountListItem
            title="Pavardė"
            value="Pavardė"
            isLast={false}
            onPress={() => {}}
          />
          <AccountListItem
            title="El. paštas"
            value="vardas@example.com"
            isLast={false}
            onPress={() => {}}
          />
          <AccountListItem
            title="Telefono numeris"
            value="+370 600 00000"
            isLast={false}
            onPress={() => {}}
          />
          <AccountListItem
            title="Gyvenamoji vieta"
            value="Klaipėda"
            isLast
            onPress={() => {}}
          />
        </AccountCard>

        <Section title="PRO PRENUMERATA" />
        <AccountCard>
          <AccountListItem
            title="Arbebus PRO"
            subtitle="Aktyvuota · Galioja iki 2026-12-31"
            icon="crown-outline"
            onPress={() => {}}
            isLast
          />
        </AccountCard>

        <AccountCard style={styles.logoutCard}>
          <AccountListItem
            title="Atsijungti"
            icon="logout"
            danger
            isLast
            onPress={() => {}}
          />
        </AccountCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  glow: {
    position: "absolute",
    top: 50,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(55,245,174,0.08)",
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.size.screenTitle,
    lineHeight: typography.lineHeight.screenTitle,
    fontWeight: typography.weight.black,
    textAlign: "center",
  },
  headerSpacer: { width: 38 },
  section: {
    color: colors.muted,
    fontSize: typography.size.section,
    lineHeight: typography.lineHeight.section,
    fontWeight: typography.weight.black,
    letterSpacing: 1.7,
    marginTop: 18,
    marginBottom: 10,
  },
  logoutCard: {
    marginTop: 20,
    borderColor: "rgba(255,118,118,0.24)",
    backgroundColor: "rgba(255,118,118,0.08)",
  },
});
