import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, shadows } from '@/core/design';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function AccountCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(55,245,174,0.18)',
    overflow: 'hidden',
    ...shadows.card,
  },
});
