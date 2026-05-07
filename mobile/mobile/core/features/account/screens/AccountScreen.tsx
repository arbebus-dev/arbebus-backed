import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/core/design';
import AccountMenu from '../components/AccountMenu';
import PaymentMethodsScreen from './PaymentMethodsScreen';
import ProfileScreen from './ProfileScreen';
import SettingsScreen from './SettingsScreen';

type Panel = 'profile' | 'payment' | 'settings' | 'legal' | null;

function FeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Pranešimai</Text>
          <Text style={styles.modalText}>Kelionės įspėjimai, vėlavimų pranešimai ir palikimo priminimai bus valdomi nustatymuose.</Text>
          <Pressable style={styles.modalButton} onPress={onClose}>
            <Text style={styles.modalButtonText}>Supratau</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function LegalScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        <View style={styles.panelHeader}>
          <Pressable onPress={onBack} hitSlop={14} style={styles.backButton}>
            <Ionicons name="chevron-back" size={21} color={colors.text} />
          </Pressable>
          <Text style={styles.panelTitle}>Teisinė informacija</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.legalCard}>
          {['Privatumo politika', 'Naudojimosi taisyklės', 'Licencijos', 'Duomenų valdymas'].map((item, index, arr) => (
            <View key={item} style={[styles.legalRow, index !== arr.length - 1 && styles.legalBorder]}>
              <Text style={styles.legalText}>{item}</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(248,251,255,0.46)" />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AccountScreen() {
  const [panel, setPanel] = useState<Panel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const back = () => setPanel(null);

  if (panel === 'profile') return <ProfileScreen onBack={back} />;
  if (panel === 'payment') return <PaymentMethodsScreen onBack={back} />;
  if (panel === 'settings') return <SettingsScreen onBack={back} />;
  if (panel === 'legal') return <LegalScreen onBack={back} />;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroGlow} />
        <Text style={styles.title}>Mano paskyra</Text>
        <Text style={styles.subtitle}>Tvarkyk paskyrą, mokėjimus ir Arbebus nustatymus vienoje vietoje.</Text>
        <AccountMenu
          onOpenProfile={() => setPanel('profile')}
          onOpenPayment={() => setPanel('payment')}
          onOpenSettings={() => setPanel('settings')}
          onOpenFeedback={() => setFeedbackOpen(true)}
          onOpenLegal={() => setPanel('legal')}
        />
      </ScrollView>
      <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 74, paddingBottom: 118 },
  heroGlow: { position: 'absolute', top: 58, right: -88, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(55,245,174,0.10)' },
  title: { color: colors.text, fontSize: typography.size.hero, lineHeight: typography.lineHeight.hero, fontWeight: typography.weight.black, letterSpacing: -0.7, marginBottom: 10 },
  subtitle: { maxWidth: 320, color: colors.muted, fontSize: typography.size.body, lineHeight: 20, fontWeight: typography.weight.medium, marginBottom: 28 },
  panelContent: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  panelHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  panelTitle: { flex: 1, color: colors.text, fontSize: typography.size.screenTitle, lineHeight: typography.lineHeight.screenTitle, fontWeight: typography.weight.black, textAlign: 'center' },
  headerSpacer: { width: 38 },
  legalCard: { borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(55,245,174,0.18)', overflow: 'hidden' },
  legalRow: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legalBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.075)' },
  legalText: { color: colors.text, fontSize: typography.size.body, lineHeight: typography.lineHeight.body, fontWeight: typography.weight.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.backgroundElevated, borderWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: 36 },
  modalTitle: { color: colors.text, fontSize: typography.size.title, lineHeight: typography.lineHeight.title, fontWeight: typography.weight.black, textAlign: 'center', marginBottom: 8 },
  modalText: { color: colors.muted, fontSize: typography.size.body, lineHeight: 20, fontWeight: typography.weight.medium, textAlign: 'center', marginBottom: 18 },
  modalButton: { minHeight: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  modalButtonText: { color: colors.textInverse, fontSize: typography.size.body, fontWeight: typography.weight.black },
});
