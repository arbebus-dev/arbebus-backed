import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadows } from '@/core/design';
import AccountMenu from '../components/AccountMenu';

type Panel = 'profile' | 'payment' | 'settings' | 'feedback' | 'legal' | null;

const C = {
  bg: colors.background,
  bg2: colors.backgroundElevated,
  card: colors.surface,
  card2: colors.surfaceStrong,
  border: colors.borderAccent,
  accent: colors.accent,
  accentSoft: 'rgba(55,245,174,0.14)',
  text: colors.text,
  muted: colors.muted,
  dim: colors.dim,
  danger: colors.danger,
};

function BackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.panelHeader}>
      <Pressable onPress={onBack} hitSlop={14} style={styles.circleButton}>
        <Ionicons name="chevron-back" size={24} color={C.text} />
      </Pressable>
      <Text style={styles.panelTitle}>{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

function Field({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="rgba(248,251,255,0.42)"
        style={styles.input}
      />
    </View>
  );
}

function ProfilePanel({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        <BackHeader
          title="Mano paskyra"
          onBack={onBack}
          right={<Text style={styles.logoutText}>Atsijungti</Text>}
        />
        <Text style={styles.sectionTitle}>Asmeninė informacija</Text>
        <Field label="Vardas" placeholder="Vardas (privaloma)" />
        <Field label="Pavardė" placeholder="Pavardė (privaloma)" />
        <Text style={styles.sectionTitle}>Kontaktinė informacija</Text>
        <View style={styles.infoCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>El. paštas</Text>
            <Text style={styles.infoValue}>Ikaterskyte@yahoo.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        </View>
        <View style={styles.infoCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Telefonas</Text>
            <Text style={styles.infoValue}>+37060775027</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        </View>
        <Text style={styles.sectionTitle}>Paskyros ištrynimas</Text>
        <Pressable style={styles.dangerRow}>
          <MaterialCommunityIcons name="trash-can-outline" size={24} color={C.danger} />
          <Text style={styles.dangerText}>Ištrinti paskyrą</Text>
          <Ionicons name="chevron-forward" size={22} color={C.danger} />
        </Pressable>
      </ScrollView>
      <View style={styles.bottomCtaWrap}>
        <Pressable style={styles.primaryCta}>
          <Text style={styles.primaryCtaText}>Išsaugoti</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PaymentPanel({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.panelContent}>
        <BackHeader title="Mokėjimo būdai" onBack={onBack} />
        <Text style={styles.sectionTitle}>Asmeniniai</Text>
        <View style={styles.paymentCard}>
          <View style={styles.paymentTop}>
            <MaterialCommunityIcons name="credit-card-outline" size={24} color={C.accent} />
            <Text style={styles.paymentTitle}>Banko kortelė</Text>
          </View>
          <Pressable style={styles.smallAccentButton}><Text style={styles.smallAccentText}>Pridėti</Text></Pressable>
          <View style={styles.divider} />
          <Text style={styles.cardDescription}>Pridėk kredito arba debeto kortelę, kad galėtum apmokėti savo keliones ir pirkinius.</Text>
        </View>
        <View style={styles.paymentOptions}>
          <Text style={styles.paymentOption}>Revolut</Text>
          <Text style={styles.paymentOption}>Paysera</Text>
          <Text style={styles.paymentOption}>Apple Pay</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const [marketing, setMarketing] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.panelContent}>
        <BackHeader title="Nustatymai" onBack={onBack} />
        <Text style={styles.sectionTitle}>Privatumas</Text>
        <View style={styles.settingBlock}>
          <View style={styles.settingRow}>
            <Text style={styles.settingTitle}>Rinkodara</Text>
            <Switch value={marketing} onValueChange={setMarketing} trackColor={{ false: '#1E293B', true: C.accent }} thumbColor="#FFFFFF" />
          </View>
          <Text style={styles.settingText}>Nurodyk, ar sutinki gauti rinkodaros pranešimus apie pasiūlymus ir naujas paslaugas.</Text>
        </View>
        <View style={styles.settingBlock}>
          <View style={styles.settingRow}>
            <Text style={styles.settingTitle}>Analitika</Text>
            <Switch value={analytics} onValueChange={setAnalytics} trackColor={{ false: '#1E293B', true: C.accent }} thumbColor="#FFFFFF" />
          </View>
          <Text style={styles.settingText}>Nurodyk, ar sutinki, kad rinktume analitinius duomenis programėlės tobulinimui.</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.settingTitle}>Vieta</Text>
          <Text style={styles.infoValueMuted}>Tik naudojant programą</Text>
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        </View>
        <Text style={styles.versionText}>Arbebus 1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>Padėk mums tobulėti</Text>
          <TextInput
            placeholder="Atsiliepimai anoniminiai. Parašyk, ką turime pagerinti."
            placeholderTextColor="rgba(248,251,255,0.42)"
            multiline
            style={styles.feedbackInput}
          />
          <Pressable style={styles.primaryCta}><Text style={styles.primaryCtaText}>Siųsti atsiliepimą</Text></Pressable>
          <Pressable style={styles.secondaryCta} onPress={onClose}><Text style={styles.secondaryCtaText}>Atšaukti</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function LegalPanel({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.panelContent}>
        <BackHeader title="Teisinė informacija" onBack={onBack} />
        {['Privatumo politika', 'Naudojimosi taisyklės', 'Licencijos', 'Duomenų valdymas'].map((item) => (
          <View key={item} style={styles.infoCard}>
            <Text style={styles.infoValue}>{item}</Text>
            <Ionicons name="chevron-forward" size={22} color={C.muted} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AccountScreen() {
  const [panel, setPanel] = useState<Panel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const back = () => setPanel(null);

  if (panel === 'profile') return <ProfilePanel onBack={back} />;
  if (panel === 'payment') return <PaymentPanel onBack={back} />;
  if (panel === 'settings') return <SettingsPanel onBack={back} />;
  if (panel === 'legal') return <LegalPanel onBack={back} />;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroGlow} />
        <Text style={styles.title}>Mano paskyra</Text>
        <Text style={styles.subtitle}>Tvarkyk paskyrą, mokėjimus ir Arbebus nustatymus vienoje vietoje.</Text>
        <AccountMenu
          onOpenProfile={() => setPanel('profile')}
          onOpenPayment={() => setPanel('payment')}
          onOpenSettings={() => setPanel('settings')}
          onOpenFeedback={() => {
            void Haptics.selectionAsync();
            setFeedbackOpen(true);
          }}
          onOpenLegal={() => setPanel('legal')}
        />
      </ScrollView>
      <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  homeContent: { paddingHorizontal: 24, paddingTop: 78, paddingBottom: 120 },
  heroGlow: { position: 'absolute', top: 42, right: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(55,245,174,0.10)' },
  title: { color: C.text, fontSize: 42, lineHeight: 47, fontWeight: '900', letterSpacing: -1.2, marginBottom: 10 },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 21, fontWeight: '700', marginBottom: 26 },
  panelContent: { paddingHorizontal: 24, paddingTop: 38, paddingBottom: 130 },
  panelHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  circleButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  panelTitle: { flex: 1, color: C.text, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1 },
  headerRight: { minWidth: 72, alignItems: 'flex-end' },
  logoutText: { color: C.muted, fontSize: 15, fontWeight: '800' },
  sectionTitle: { color: C.text, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 18, marginBottom: 12 },
  fieldBox: { minHeight: 66, borderRadius: 18, backgroundColor: C.card2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, justifyContent: 'center', marginBottom: 12 },
  fieldLabel: { color: C.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  input: { color: C.text, fontSize: 18, fontWeight: '800', padding: 0 },
  infoCard: { minHeight: 70, borderRadius: 18, backgroundColor: C.card2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  infoValue: { color: C.text, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  infoValueMuted: { flex: 1, textAlign: 'right', color: C.muted, fontSize: 15, fontWeight: '800' },
  dangerRow: { minHeight: 62, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,107,107,0.10)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.22)' },
  dangerText: { flex: 1, color: C.danger, fontSize: 18, fontWeight: '900' },
  bottomCtaWrap: { position: 'absolute', left: 24, right: 24, bottom: 28 },
  primaryCta: { minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  primaryCtaText: { color: '#051813', fontSize: 17, fontWeight: '900' },
  paymentCard: { borderRadius: 24, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 24 },
  paymentTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  paymentTitle: { color: C.text, fontSize: 20, fontWeight: '900' },
  smallAccentButton: { alignSelf: 'flex-start', borderRadius: 16, backgroundColor: C.accent, paddingHorizontal: 18, paddingVertical: 9, marginBottom: 14 },
  smallAccentText: { color: '#051813', fontSize: 14, fontWeight: '900' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 14 },
  cardDescription: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  paymentOptions: { paddingLeft: 20, gap: 4 },
  paymentOption: { color: C.accent, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  settingBlock: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, marginBottom: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  settingTitle: { color: C.text, fontSize: 19, fontWeight: '900' },
  settingText: { color: C.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  versionText: { color: C.dim, textAlign: 'center', fontSize: 14, fontWeight: '800', marginTop: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
  feedbackCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, padding: 24, paddingBottom: 36 },
  feedbackTitle: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, textAlign: 'center', marginBottom: 18 },
  feedbackInput: { minHeight: 124, borderRadius: 20, backgroundColor: C.card2, color: C.text, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, fontSize: 16, lineHeight: 21, fontWeight: '700', textAlignVertical: 'top', marginBottom: 14 },
  secondaryCta: { minHeight: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12 },
  secondaryCtaText: { color: C.text, fontSize: 17, fontWeight: '900' },
});
