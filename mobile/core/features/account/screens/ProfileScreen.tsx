import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, typography } from "@/core/design";
import AccountCard from "../components/AccountCard";
import AccountListItem from "../components/AccountListItem";
import ProfileHeader from "../components/ProfileHeader";
import type { UserProfile } from "../accountTypes";
import { useAccountTheme } from "../context/AppPreferencesContext";
import { loadUserProfile, saveUserProfile } from "../services/accountStorage";

type Props = { onBack: () => void };
type EditableKey = keyof Pick<UserProfile, "firstName" | "lastName" | "email" | "phone" | "city" | "country" | "birthDate" | "avatarUri">;

const fields: { key: EditableKey; title: string; placeholder: string; keyboardType?: "default" | "email-address" | "phone-pad" }[] = [
  { key: "firstName", title: "Vardas", placeholder: "Įveskite vardą" },
  { key: "lastName", title: "Pavardė", placeholder: "Įveskite pavardę" },
  { key: "email", title: "El. paštas", placeholder: "vardas@domain.com", keyboardType: "email-address" },
  { key: "phone", title: "Telefono numeris", placeholder: "+370 600 00000", keyboardType: "phone-pad" },
  { key: "city", title: "Miestas", placeholder: "Klaipėda" },
  { key: "country", title: "Šalis", placeholder: "Lietuva" },
  { key: "birthDate", title: "Gimimo data", placeholder: "YYYY-MM-DD" },
  { key: "avatarUri", title: "Profilio nuotrauka", placeholder: "https://... arba palikite tuščią" },
];

function Section({ title }: { title: string }) {
  const theme = useAccountTheme();
  return <Text style={[styles.section, { color: theme.muted }]}>{title}</Text>;
}

export default function ProfileScreen({ onBack }: Props) {
  const theme = useAccountTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingKey, setEditingKey] = useState<EditableKey | null>(null);
  const [draftValue, setDraftValue] = useState("");

  useEffect(() => {
    let mounted = true;
    loadUserProfile().then((item) => {
      if (mounted) setProfile(item);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeField = useMemo(() => fields.find((field) => field.key === editingKey) || null, [editingKey]);

  const openEdit = (key: EditableKey) => {
    if (!profile) return;
    const current = profile[key] || "";
    setEditingKey(key);
    setDraftValue(current);
    void Haptics.selectionAsync();
  };

  const closeEdit = () => {
    setEditingKey(null);
    setDraftValue("");
  };

  const saveField = async () => {
    if (!profile || !editingKey) return;
    const next = { ...profile, [editingKey]: draftValue.trim() };
    setProfile(next);
    await saveUserProfile(next);
    closeEdit();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const updateAvatarNote = () => {
    openEdit("avatarUri");
  };

  const readyProfile = profile || {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "Klaipėda",
    country: "Lietuva",
    birthDate: "",
    avatarUri: null,
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.glow, { backgroundColor: theme.isLight ? "rgba(55,245,174,0.20)" : "rgba(55,245,174,0.08)" }]} />
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={14} style={[styles.backButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}> 
            <Ionicons name="chevron-back" size={21} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profilis</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ProfileHeader profile={readyProfile} onEditAvatar={updateAvatarNote} />

        <Section title="ASMENINĖ INFORMACIJA" />
        <AccountCard>
          {fields.map((field, index) => (
            <AccountListItem
              key={field.key}
              title={field.title}
              value={readyProfile[field.key] || "Įvesti"}
              isLast={index === fields.length - 1}
              onPress={() => openEdit(field.key)}
            />
          ))}
        </AccountCard>

        <Section title="PRO PRENUMERATA" />
        <AccountCard>
          <AccountListItem
            title="Arbebus PRO"
            subtitle="Paruošta RevenueCat / App Store prenumeratai"
            icon="crown-outline"
            onPress={() => Alert.alert("Arbebus PRO", "PRO prenumerata turi būti jungiama per RevenueCat/App Store pirkimus.")}
            isLast
          />
        </AccountCard>
      </ScrollView>

      <Modal visible={!!editingKey} transparent animationType="slide" onRequestClose={closeEdit}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}> 
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}> 
            <Text style={[styles.modalTitle, { color: theme.text }]}>{activeField?.title}</Text>
            <TextInput
              value={draftValue}
              onChangeText={setDraftValue}
              placeholder={activeField?.placeholder}
              placeholderTextColor={theme.dim}
              keyboardType={activeField?.keyboardType || "default"}
              autoCapitalize={editingKey === "email" ? "none" : "sentences"}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.secondaryButton, { backgroundColor: theme.surfaceSoft }]} onPress={closeEdit}>
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Atšaukti</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={saveField}>
                <Text style={styles.primaryButtonText}>Išsaugoti</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  glow: { position: "absolute", top: 50, right: -100, width: 250, height: 250, borderRadius: 125 },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { flex: 1, fontSize: typography.size.screenTitle, lineHeight: typography.lineHeight.screenTitle, fontWeight: typography.weight.black, textAlign: "center" },
  headerSpacer: { width: 38 },
  section: { fontSize: typography.size.section, lineHeight: typography.lineHeight.section, fontWeight: typography.weight.black, letterSpacing: 1.7, marginTop: 18, marginBottom: 10 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 24, paddingBottom: 38 },
  modalTitle: { fontSize: typography.size.title, lineHeight: typography.lineHeight.title, fontWeight: typography.weight.black, marginBottom: 14, textAlign: "center" },
  input: { minHeight: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, fontSize: typography.size.body, fontWeight: typography.weight.bold },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  secondaryButton: { flex: 1, minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  secondaryButtonText: { fontSize: typography.size.body, fontWeight: typography.weight.black },
  primaryButtonText: { color: colors.textInverse, fontSize: typography.size.body, fontWeight: typography.weight.black },
});
