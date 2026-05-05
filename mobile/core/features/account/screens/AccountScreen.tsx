import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLanguage } from "@/core/i18n/LanguageContext";
import AccountMenu from "../components/AccountMenu";

type Panel = "profile" | "payment" | "settings" | "legal" | null;

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.panelHeader}>
      <Pressable onPress={onClose} style={styles.backButton} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
      </Pressable>
      <Text style={styles.panelTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function AccountScreen() {
  const { t, language, setLanguage } = useLanguage();
  const [panel, setPanel] = useState<Panel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const openPanel = (next: "profile" | "payment" | "settings" | "feedback" | "legal") => {
    if (next === "feedback") {
      setFeedbackOpen(true);
      return;
    }
    setPanel(next);
  };

  const closePanel = () => setPanel(null);

  const panelTitle = panel ? {
    profile: t.account.profile,
    payment: t.account.payment,
    settings: t.account.settings,
    legal: t.account.legal,
  }[panel] : "";

  return (
    <SafeAreaView style={styles.screen}>
      {!panel ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#06111F" />
            </View>
            <Text style={styles.heroTitle}>{t.account.title}</Text>
            <Text style={styles.heroSubtitle}>{t.account.subtitle}</Text>
          </View>
          <AccountMenu onSelect={openPanel} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PanelHeader title={panelTitle} onClose={closePanel} />

          {panel === "profile" ? (
            <View style={styles.panelCard}>
              <InfoRow label={t.account.name} value="Arbebus vartotojas" />
              <InfoRow label={t.account.email} value="guest@arbebus.app" />
              <InfoRow label={t.account.language} value={language.toUpperCase()} />
            </View>
          ) : null}

          {panel === "payment" ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardTitle}>{t.account.paymentEmptyTitle}</Text>
              <Text style={styles.cardText}>{t.account.paymentEmptyText}</Text>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{t.account.addPayment}</Text>
              </Pressable>
            </View>
          ) : null}

          {panel === "settings" ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardTitle}>{t.account.language}</Text>
              <View style={styles.languageRow}>
                <Pressable
                  style={[styles.langButton, language === "lt" && styles.langButtonActive]}
                  onPress={() => { void Haptics.selectionAsync(); void setLanguage("lt"); }}
                >
                  <Text style={[styles.langText, language === "lt" && styles.langTextActive]}>LT</Text>
                </Pressable>
                <Pressable
                  style={[styles.langButton, language === "en" && styles.langButtonActive]}
                  onPress={() => { void Haptics.selectionAsync(); void setLanguage("en"); }}
                >
                  <Text style={[styles.langText, language === "en" && styles.langTextActive]}>EN</Text>
                </Pressable>
              </View>
              <InfoRow label={t.account.notifications} value={t.account.enabled} />
              <InfoRow label={t.account.mapProvider} value="Apple Maps iOS" />
            </View>
          ) : null}

          {panel === "legal" ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardTitle}>{t.account.legalTitle}</Text>
              <Text style={styles.cardText}>{t.account.legalText}</Text>
              <InfoRow label="Version" value="1.0.1" />
              <InfoRow label="Bundle" value="com.arbebus.app" />
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={feedbackOpen} transparent animationType="slide" onRequestClose={() => setFeedbackOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.account.feedback}</Text>
            <Text style={styles.modalText}>{t.account.feedbackModalText}</Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder={t.account.feedbackPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.45)"
              multiline
              style={styles.feedbackInput}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setFeedbackOpen(false)}>
                <Text style={styles.secondaryButtonText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setFeedback("");
                  setFeedbackOpen(false);
                }}
              >
                <Text style={styles.primaryButtonText}>{t.common.send}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#03070B" },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 110 },
  hero: { alignItems: "center", paddingVertical: 22 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#35F2B4", marginBottom: 13 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  heroSubtitle: { color: "rgba(255,255,255,0.62)", fontSize: 14, fontWeight: "700", marginTop: 6, textAlign: "center" },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  panelTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900" },
  panelCard: { borderRadius: 26, padding: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  infoRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.09)" },
  infoLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  infoValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 4 },
  cardTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginBottom: 8 },
  cardText: { color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginBottom: 14 },
  primaryButton: { minHeight: 46, borderRadius: 18, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#35F2B4" },
  primaryButtonText: { color: "#06111F", fontSize: 15, fontWeight: "900" },
  secondaryButton: { minHeight: 46, borderRadius: 18, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  secondaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  languageRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  langButton: { flex: 1, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.09)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  langButtonActive: { backgroundColor: "#35F2B4", borderColor: "#35F2B4" },
  langText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  langTextActive: { color: "#06111F" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, backgroundColor: "#07101D" },
  modalTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  modalText: { color: "rgba(255,255,255,0.64)", fontSize: 14, lineHeight: 20, fontWeight: "700", marginTop: 8 },
  feedbackInput: { minHeight: 118, marginTop: 14, borderRadius: 20, padding: 14, color: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.08)", textAlignVertical: "top", fontSize: 15, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
});
