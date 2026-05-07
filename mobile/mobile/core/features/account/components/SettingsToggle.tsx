import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, typography } from '@/core/design';

type Props = {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
};

export default function SettingsToggle({ title, value, onValueChange, isLast }: Props) {
  return (
    <View style={[styles.row, !isLast && styles.border]}>
      <Text style={styles.title}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.14)', true: colors.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="rgba(255,255,255,0.14)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.075)',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
});
