import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/core/design';
import type { AppLanguage } from '@/core/i18n/translations';
import AccountCard from '../components/AccountCard';
import AccountListItem from '../components/AccountListItem';
import SettingsToggle from '../components/SettingsToggle';
import { useAccountTheme, useAppPreferences } from '../context/AppPreferencesContext';

type Props = { onBack: () => void };

function Section({ title }: { title: string }) {
  const theme = useAccountTheme();
  return <Text style={[styles.section, { color: theme.muted }]}>{title}</Text>;
}

function ChoiceRow<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useAccountTheme();
  return (
    <View style={[styles.choiceRow, { borderBottomColor: theme.border }]}> 
      <Text style={[styles.choiceTitle, { color: theme.text }]}>{title}</Text>
      <View style={[styles.segment, { backgroundColor: theme.surfaceSoft }]}> 
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(option.value);
              }}
            >
              <Text style={[styles.segmentText, { color: active ? colors.textInverse : theme.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen({ onBack }: Props) {
  const theme = useAccountTheme();
  const { preferences, setPreference, setThemeMode, setAppLanguage, requestNotificationPermissions } = useAppPreferences();

  const enableNotifications = async (value: boolean) => {
    if (!value) {
      await setPreference('notificationsEnabled', false);
      return;
    }
    const granted = await requestNotificationPermissions();
    await setPreference('notificationsEnabled', granted);
    if (!granted) Alert.alert('Pranešimai', 'Leidimas nepriduotas. Įjunkite pranešimus iOS nustatymuose.');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={14} style={[styles.backButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}> 
            <Ionicons name="chevron-back" size={21} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Nustatymai</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Section title="PROGRAMĖLĖ" />
        <AccountCard>
          <ChoiceRow<AppLanguage>
            title="Kalba"
            value={preferences.language}
            options={[{ label: 'LT', value: 'lt' }, { label: 'EN', value: 'en' }]}
            onChange={(value) => setAppLanguage(value)}
          />
          <ChoiceRow
            title="Tema"
            value={preferences.themeMode}
            options={[{ label: 'Tamsi', value: 'dark' }, { label: 'Šviesi', value: 'light' }]}
            onChange={(value) => setThemeMode(value)}
          />
          <AccountListItem
            title="Pranešimų garsas"
            value={preferences.notificationSound === 'arbebus' ? 'Arbebus chime' : 'Default'}
            subtitle="Custom garsą pridėsime kaip .wav asset kitame etape"
            ionIcon="musical-notes-outline"
            onPress={() => setPreference('notificationSound', preferences.notificationSound === 'default' ? 'arbebus' : 'default')}
            isLast
          />
        </AccountCard>

        <Section title="PRANEŠIMAI" />
        <AccountCard>
          <SettingsToggle title="Pranešimai" subtitle="Bendras pranešimų leidimas" value={preferences.notificationsEnabled} onValueChange={enableNotifications} />
          <SettingsToggle title="Kelionės įspėjimai" value={preferences.tripAlerts} onValueChange={(value) => setPreference('tripAlerts', value)} />
          <SettingsToggle title="Vėlavimų pranešimai" value={preferences.delayAlerts} onValueChange={(value) => setPreference('delayAlerts', value)} />
          <SettingsToggle title="Priminimai" value={preferences.leaveReminders} onValueChange={(value) => setPreference('leaveReminders', value)} />
          <SettingsToggle title="Bilietų / mokėjimų pranešimai" value={preferences.paymentNotifications} onValueChange={(value) => setPreference('paymentNotifications', value)} isLast />
        </AccountCard>

        <Section title="MOKĖJIMAI" />
        <AccountCard>
          <SettingsToggle
            title="Automatiniai mokėjimai"
            subtitle="Naudoti pagrindinį mokėjimo būdą, kai tai leidžiama"
            value={preferences.autoPayments}
            onValueChange={(value) => setPreference('autoPayments', value)}
            isLast
          />
        </AccountCard>

        <Section title="KITA" />
        <AccountCard>
          <AccountListItem title="Apie programėlę" value="1.0.1" ionIcon="information-circle-outline" isLast />
        </AccountCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 34 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { flex: 1, fontSize: typography.size.screenTitle, lineHeight: typography.lineHeight.screenTitle, fontWeight: typography.weight.black, textAlign: 'center' },
  headerSpacer: { width: 38 },
  section: { fontSize: typography.size.section, lineHeight: typography.lineHeight.section, fontWeight: typography.weight.black, letterSpacing: 1.7, marginTop: 16, marginBottom: 10 },
  choiceRow: { minHeight: 66, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  choiceTitle: { flex: 1, fontSize: typography.size.body, lineHeight: typography.lineHeight.body, fontWeight: typography.weight.bold },
  segment: { flexDirection: 'row', borderRadius: 16, padding: 3, gap: 3 },
  segmentItem: { minWidth: 66, minHeight: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  segmentItemActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: typography.size.caption, lineHeight: typography.lineHeight.caption, fontWeight: typography.weight.black },
});
