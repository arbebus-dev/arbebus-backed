import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLanguage } from "@/core/i18n/LanguageContext";
import AccountMenu from "../components/AccountMenu";

type Panel = "profile" | "payment" | "settings" | "legal" | null;

const PINK = "#FF0A8A";

function PanelHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.panelHeader}>
      <Pressable onPress={onBack} hitSlop={14} style={styles.backButton}>
        <Ionicons name="arrow-back" size={27} color="#111827" />
      </Pressable>
      {right ? <View style={styles.panelRight}>{right}</View> : null}
      <Text style={styles.panelTitle}>{title}</Text>
    </View>
  );
}

function FieldBox({ label, value, chevron }: { label: string; value?: string; chevron?: boolean }) {
  return (
    <View style={styles.fieldBox}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {value ? <Text style={styles.fieldValue}>{value}</Text> : null}
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={24} color="#111827" /> : null}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function AccountScreen() {
  const { t, language, setLanguage } = useLanguage();
  const [panel, setPanel] = useState<Panel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [marketing, setMarketing] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  const openPanel = (next: "profile" | "payment" | "settings" | "feedback" | "legal") => {
    if (next === "feedback") {
      setFeedbackOpen(true);
      return;
    }
    setPanel(next);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {!panel ? (
        <ScrollView contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t.account.title}</Text>
          <AccountMenu onSelect={openPanel} />
        </ScrollView>
      ) : null}

      {panel === "profile" ? (
        <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
          <PanelHeader
            title={t.account.title}
            onBack={() => setPanel(null)}
            right={<Text style={styles.logoutText}>Atsijungti</Text>}
          />
          <SectionTitle>{t.account.personalInfo}</SectionTitle>
          <FieldBox label="Vardas (privaloma)" />
          <FieldBox label="Pavardė (privaloma)" />
          <SectionTitle>{t.account.contactInfo}</SectionTitle>
          <FieldBox label="El. paštas (privaloma)" value="guest@arbebus.app" chevron />
          <FieldBox label="Telefonas" value="+370" chevron />
          <SectionTitle>Paskyros ištrynimas</SectionTitle>
          <Pressable style={styles.deleteRow}>
            <MaterialCommunityIcons name="trash-can-outline" size={25} color="#E11D28" />
            <Text style={styles.deleteText}>{t.account.deleteAccount}</Text>
            <Ionicons name="chevron-forward" size={24} color="#E11D28" />
          </Pressable>
          <Pressable style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{t.common.save}</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {panel === "payment" ? (
        <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
          <PanelHeader title={t.account.payment} onBack={() => setPanel(null)} />
          <SectionTitle>Asmeniniai</SectionTitle>
          <View style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <MaterialCommunityIcons name="credit-card-outline" size={25} color="#111827" />
              <Text style={styles.paymentTitle}>{t.account.paymentEmptyTitle}</Text>
            </View>
            <Pressable style={styles.smallPinkButton}><Text style={styles.smallPinkButtonText}>{t.account.addPayment}</Text></Pressable>
            <View style={styles.thinLine} />
            <Text style={styles.paymentText}>{t.account.paymentEmptyText}</Text>
          </View>
          <Text style={styles.paymentProvider}>Revolut{"\n"}Paysera{"\n"}Apple Pay</Text>
        </ScrollView>
      ) : null}

      {panel === "settings" ? (
        <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
          <PanelHeader title={t.account.settings} onBack={() => setPanel(null)} />
          <SectionTitle>BENDRIEJI</SectionTitle>
          <Pressable
            style={styles.settingsRow}
            onPress={() => {
              void Haptics.selectionAsync();
              void setLanguage(language === "lt" ? "en" : "lt");
            }}
          >
            <Text style={styles.settingsTitle}>{t.account.language}</Text>
            <Text style={styles.settingsValue}>{language === "lt" ? "Lietuvių" : "English"}</Text>
            <Ionicons name="chevron-forward" size={24} color="#111827" />
          </Pressable>
          <SectionTitle>PRIVATUMAS</SectionTitle>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTitle}>{t.account.marketing}</Text>
              <Text style={styles.settingsDescription}>Nurodyk, ar sutinki gauti rinkodaros pranešimus apie įvairius pasiūlymus, akcijas ar naujas paslaugas.</Text>
            </View>
            <Switch value={marketing} onValueChange={setMarketing} trackColor={{ true: PINK, false: "#D1D5DB" }} thumbColor="#FFFFFF" />
          </View>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTitle}>{t.account.analytics}</Text>
              <Text style={styles.settingsDescription}>Nurodyk, ar sutinki, kad rinktume analitinius duomenis programėlės tobulinimo tikslais.</Text>
            </View>
            <Switch value={analytics} onValueChange={setAnalytics} trackColor={{ true: PINK, false: "#D1D5DB" }} thumbColor="#FFFFFF" />
          </View>
          <View style={styles.settingsRowBordered}>
            <Text style={styles.settingsTitle}>{t.account.location}</Text>
            <Text style={styles.settingsValue}>{t.account.locationValue}</Text>
            <Ionicons name="chevron-forward" size={24} color="#111827" />
          </View>
          <Text style={styles.versionText}>1.0.1</Text>
        </ScrollView>
      ) : null}

      {panel === "legal" ? (
        <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
          <PanelHeader title={t.account.legal} onBack={() => setPanel(null)} />
          <View style={styles.legalCard}>
            <Text style={styles.legalTitle}>{t.account.legalTitle}</Text>
            <Text style={styles.legalText}>{t.account.legalText}</Text>
            <Text style={styles.legalMeta}>Bundle: com.arbebus.app{"\n"}Version: 1.0.1</Text>
          </View>
        </ScrollView>
      ) : null}

      <Modal visible={feedbackOpen} transparent animationType="fade" onRequestClose={() => setFeedbackOpen(false)}>
        <View style={styles.feedbackOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFeedbackOpen(false)} />
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>{t.account.feedback}</Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder={t.account.feedbackPlaceholder}
              placeholderTextColor="rgba(17,24,39,0.35)"
              multiline
              style={styles.feedbackInput}
            />
            <Pressable
              style={styles.feedbackButton}
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setFeedback("");
                setFeedbackOpen(false);
              }}
            >
              <Text style={styles.feedbackButtonText}>{t.common.send} atsiliepimą</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setFeedbackOpen(false)}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  menuContent: { paddingHorizontal: 28, paddingTop: 118, paddingBottom: 120 },
  title: { color: "#111827", fontSize: 42, lineHeight: 48, fontWeight: "900", letterSpacing: -1.2, marginBottom: 58 },
  panelContent: { paddingHorizontal: 26, paddingTop: 42, paddingBottom: 120 },
  panelHeader: { minHeight: 116, justifyContent: "flex-end", marginBottom: 18 },
  backButton: { position: "absolute", left: -6, top: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  panelRight: { position: "absolute", right: 0, top: 22 },
  logoutText: { color: "#111827", fontSize: 17, fontWeight: "700" },
  panelTitle: { color: "#111827", fontSize: 38, lineHeight: 44, fontWeight: "900", letterSpacing: -1.1 },
  sectionTitle: { color: "#111827", fontSize: 19, fontWeight: "900", marginTop: 26, marginBottom: 16 },
  fieldBox: { minHeight: 64, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", backgroundColor: "#F1F1F2", marginBottom: 14 },
  fieldLabel: { color: "rgba(17,24,39,0.48)", fontSize: 17, fontWeight: "600" },
  fieldValue: { color: "#111827", fontSize: 20, fontWeight: "700", marginTop: 4 },
  deleteRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 16 },
  deleteText: { flex: 1, color: "#E11D28", fontSize: 20, fontWeight: "800" },
  saveButton: { height: 64, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: PINK, marginTop: 38 },
  saveButtonText: { color: "#FFFFFF", fontSize: 21, fontWeight: "900" },
  paymentCard: { borderRadius: 20, padding: 20, backgroundColor: "#F2F2F3" },
  paymentHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  paymentTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  smallPinkButton: { alignSelf: "flex-start", borderRadius: 18, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: PINK },
  smallPinkButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  thinLine: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(17,24,39,0.12)", marginVertical: 18 },
  paymentText: { color: "#111827", fontSize: 17, lineHeight: 23, fontWeight: "600" },
  paymentProvider: { color: "#991B1B", fontSize: 31, lineHeight: 37, fontWeight: "500", marginLeft: 34, marginTop: 26 },
  settingsRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  settingsRowBordered: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(17,24,39,0.12)", marginTop: 8 },
  settingsTitle: { color: "#111827", fontSize: 22, fontWeight: "700" },
  settingsValue: { flex: 1, color: "rgba(17,24,39,0.45)", fontSize: 20, fontWeight: "700", textAlign: "right" },
  settingsDescription: { color: "rgba(17,24,39,0.55)", fontSize: 16, lineHeight: 21, fontWeight: "600", marginTop: 12, paddingRight: 10 },
  toggleRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 28 },
  versionText: { color: "rgba(17,24,39,0.32)", textAlign: "center", fontSize: 17, fontWeight: "700", marginTop: 46 },
  legalCard: { borderRadius: 22, padding: 20, backgroundColor: "#F2F2F3" },
  legalTitle: { color: "#111827", fontSize: 22, fontWeight: "900" },
  legalText: { color: "rgba(17,24,39,0.62)", fontSize: 16, lineHeight: 23, fontWeight: "600", marginTop: 12 },
  legalMeta: { color: "rgba(17,24,39,0.45)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 18 },
  feedbackOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  feedbackCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 26, paddingBottom: 38, backgroundColor: "#FFFFFF" },
  feedbackTitle: { color: "#111827", fontSize: 31, fontWeight: "900", textAlign: "center", marginBottom: 22 },
  feedbackInput: { minHeight: 128, borderRadius: 16, padding: 16, color: "#111827", backgroundColor: "#F2F2F3", textAlignVertical: "top", fontSize: 18, fontWeight: "600" },
  feedbackButton: { height: 58, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#F58AC8", marginTop: 18 },
  feedbackButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  cancelButton: { height: 56, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#F0ECEF", marginTop: 14 },
  cancelText: { color: "#111827", fontSize: 18, fontWeight: "900" },
});
