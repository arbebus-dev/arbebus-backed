import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { shadows } from '@/core/design';
import { useAccountTheme } from '../context/AppPreferencesContext';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function AccountCard({ children, style }: Props) {
  const theme = useAccountTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.isLight ? 'rgba(7,17,31,0.10)' : 'rgba(55,245,174,0.18)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.card,
  },
});
