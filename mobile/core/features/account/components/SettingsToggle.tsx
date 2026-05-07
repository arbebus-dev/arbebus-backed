import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, typography } from '@/core/design';
import { useAccountTheme } from '../context/AppPreferencesContext';

type Props = {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
};

export default function SettingsToggle({ title, subtitle, value, onValueChange, isLast }: Props) {
  const theme = useAccountTheme();
  return (
    <View style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}> 
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.isLight ? 'rgba(7,17,31,0.18)' : 'rgba(255,255,255,0.14)', true: colors.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={theme.isLight ? 'rgba(7,17,31,0.18)' : 'rgba(255,255,255,0.14)'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  textBlock: { flex: 1, gap: 2 },
  title: {
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.medium,
  },
});
