import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/core/design';
import AccountCard from '../components/AccountCard';
import AccountListItem from '../components/AccountListItem';
import AccountMenu from '../components/AccountMenu';
import { useAccountTheme } from '../context/AppPreferencesContext';
import HelpScreen from './HelpScreen';
import PaymentMethodsScreen from './PaymentMethodsScreen';
import ProfileScreen from './ProfileScreen';
import SettingsScreen from './SettingsScreen';

type Panel = 'profile' | 'payment' | 'settings' | 'help' | 'legal' | null;

const CONTACT_EMAIL = 'arbebus@gmail.com';
const PRIVACY_URL = 'https://arbebus.com/privacy.html';
const TERMS_URL = 'https://arbebus.com/terms.html';

async function openUrl(url: string) {
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) await Linking.openURL(url);
  else Alert.alert('Nuoroda', url);
}

function LegalScreen({ onBack }: { onBack: () => void }) {
  const theme = useAccountTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        <View style={styles.panelHeader}>
          <Pressable onPress={onBack} hitSlop={14} style={[styles.backButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}> 
            <Ionicons name="chevron-back" size={21} color={theme.text} />
          </Pressable>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Teisinė informacija</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.section, { color: theme.muted }]}>ARBEBUS</Text>
        <AccountCard>
          <AccountListItem title="Įmonė" value="UAB Arbebus" ionIcon="business-outline" />
          <AccountListItem title="Duomenų valdytojas" value="UAB Arbebus" ionIcon="shield-checkmark-outline" isLast />
        </AccountCard>

        <Text style={[styles.section, { color: theme.muted }]}>DOKUMENTAI</Text>
        <AccountCard>
          <AccountListItem title="Privatumo politika" subtitle="Asmens duomenų tvarkymas" ionIcon="lock-closed-outline" onPress={() => openUrl(PRIVACY_URL)} />
          <AccountListItem title="Naudojimosi taisyklės" subtitle="Programėlės sąlygos" ionIcon="document-text-outline" onPress={() => openUrl(TERMS_URL)} />
          <AccountListItem title="Licencijos" subtitle="Naudojamos bibliotekos ir atviro kodo paketai" ionIcon="code-slash-outline" onPress={() => Alert.alert('Licencijos', 'Licencijų sąrašas bus rodomas atskirame production ekrane.')} />
          <AccountListItem title="Programėlės versija" value="1.0.1" ionIcon="phone-portrait-outline" isLast />
        </AccountCard>

        <Text style={[styles.section, { color: theme.muted }]}>KONTAKTAI</Text>
        <AccountCard>
          <AccountListItem title="El. paštas" value={CONTACT_EMAIL} ionIcon="mail-outline" onPress={() => openUrl(`mailto:${CONTACT_EMAIL}`)} isLast />
        </AccountCard>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AccountScreen() {
  const theme = useAccountTheme();
  const [panel, setPanel] = useState<Panel>(null);
  const back = () => setPanel(null);

  if (panel === 'profile') return <ProfileScreen onBack={back} />;
  if (panel === 'payment') return <PaymentMethodsScreen onBack={back} />;
  if (panel === 'settings') return <SettingsScreen onBack={back} />;
  if (panel === 'help') return <HelpScreen onBack={back} />;
  if (panel === 'legal') return <LegalScreen onBack={back} />;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroGlow, { backgroundColor: theme.isLight ? 'rgba(55,245,174,0.22)' : 'rgba(55,245,174,0.10)' }]} />
        <Text style={[styles.title, { color: theme.text }]}>Mano paskyra</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Tvarkyk profilį, mokėjimus, nustatymus, pagalbą ir teisinę informaciją vienoje vietoje.</Text>
        <AccountMenu
          onOpenProfile={() => setPanel('profile')}
          onOpenPayment={() => setPanel('payment')}
          onOpenSettings={() => setPanel('settings')}
          onOpenHelp={() => setPanel('help')}
          onOpenLegal={() => setPanel('legal')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 74, paddingBottom: 118 },
  heroGlow: { position: 'absolute', top: 58, right: -88, width: 240, height: 240, borderRadius: 120 },
  title: { fontSize: typography.size.hero, lineHeight: typography.lineHeight.hero, fontWeight: typography.weight.black, letterSpacing: -0.7, marginBottom: 10 },
  subtitle: { maxWidth: 330, fontSize: typography.size.body, lineHeight: 20, fontWeight: typography.weight.medium, marginBottom: 28 },
  panelContent: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  panelHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  panelTitle: { flex: 1, fontSize: typography.size.screenTitle, lineHeight: typography.lineHeight.screenTitle, fontWeight: typography.weight.black, textAlign: 'center' },
  headerSpacer: { width: 38 },
  section: { fontSize: typography.size.section, lineHeight: typography.lineHeight.section, fontWeight: typography.weight.black, letterSpacing: 1.7, marginTop: 16, marginBottom: 10 },
});
