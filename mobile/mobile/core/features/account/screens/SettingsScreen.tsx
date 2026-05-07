import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/core/design';
import AccountCard from '../components/AccountCard';
import AccountListItem from '../components/AccountListItem';
import SettingsToggle from '../components/SettingsToggle';

type Props = { onBack: () => void };

function Section({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

export default function SettingsScreen({ onBack }: Props) {
  const [dark, setDark] = useState(true);
  const [tripAlerts, setTripAlerts] = useState(true);
  const [delayAlerts, setDelayAlerts] = useState(true);
  const [leaveReminders, setLeaveReminders] = useState(true);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={14} style={styles.backButton}>
            <Ionicons name="chevron-back" size={21} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Nustatymai</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Section title="PROGRAMĖLĖ" />
        <AccountCard>
          <AccountListItem title="Kalba" value="Lietuvių" onPress={() => {}} />
          <SettingsToggle title="Tamsus režimas" value={dark} onValueChange={setDark} />
          <AccountListItem title="Atstumų vienetai" value="Kilometrai" onPress={() => {}} />
          <AccountListItem title="Laiko formatas" value="24 val." onPress={() => {}} isLast />
        </AccountCard>

        <Section title="PRANEŠIMAI" />
        <AccountCard>
          <SettingsToggle title="Kelionės įspėjimai" value={tripAlerts} onValueChange={setTripAlerts} />
          <SettingsToggle title="Vėlavimų pranešimai" value={delayAlerts} onValueChange={setDelayAlerts} />
          <SettingsToggle title="Palikimo priminimai" value={leaveReminders} onValueChange={setLeaveReminders} isLast />
        </AccountCard>

        <Section title="KITA" />
        <AccountCard>
          <AccountListItem title="Išvalyti talpyklą" value="45 MB" onPress={() => {}} />
          <AccountListItem title="Apie programėlę" value="1.0.0" onPress={() => {}} isLast />
        </AccountCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 34 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { flex: 1, color: colors.text, fontSize: typography.size.screenTitle, lineHeight: typography.lineHeight.screenTitle, fontWeight: typography.weight.black, textAlign: 'center' },
  headerSpacer: { width: 38 },
  section: { color: colors.muted, fontSize: typography.size.section, lineHeight: typography.lineHeight.section, fontWeight: typography.weight.black, letterSpacing: 1.7, marginTop: 16, marginBottom: 10 },
});
