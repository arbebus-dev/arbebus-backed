import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/core/design';
import type { PaymentMethod, PaymentMethodBrand } from '../accountTypes';
import { useAccountTheme } from '../context/AppPreferencesContext';
import AccountCard from './AccountCard';

type Props = {
  method: PaymentMethod;
  onSetDefault?: () => void;
  onRemove?: () => void;
};

function brandIcon(brand: PaymentMethodBrand) {
  if (brand === 'apple') return <Ionicons name="logo-apple" size={24} color={colors.text} />;
  if (brand === 'revolut') return <Text style={styles.revolut}>R</Text>;
  if (brand === 'bank') return <MaterialCommunityIcons name="bank-outline" size={23} color={colors.accent} />;
  if (brand === 'visa') return <Text style={styles.visa}>VISA</Text>;
  if (brand === 'mastercard') return <Text style={styles.mastercard}>●●</Text>;
  return <Ionicons name="card-outline" size={23} color={colors.accent} />;
}

export default function PaymentCard({ method, onSetDefault, onRemove }: Props) {
  const theme = useAccountTheme();
  const title = method.last4 ? `${method.title} •••• ${method.last4}` : method.title;
  const subtitle = method.expiry ? `Galioja iki ${method.expiry}` : 'Saugus mokėjimo būdas';
  return (
    <AccountCard style={styles.card}>
      <View style={[styles.brandBox, { backgroundColor: theme.surfaceSoft }]}>{brandIcon(method.brand)}</View>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.badge, method.isDefault ? styles.badgeActive : { backgroundColor: theme.surfaceSoft }]}
          onPress={() => {
            void Haptics.selectionAsync();
            onSetDefault?.();
          }}
        >
          <Text style={[styles.badgeText, { color: method.isDefault ? colors.textInverse : theme.text }]}>{method.isDefault ? 'Pagrindinė' : 'Rinktis'}</Text>
        </Pressable>
        <Pressable
          style={[styles.removeButton, { backgroundColor: theme.surfaceSoft }]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRemove?.();
          }}
        >
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
        </Pressable>
      </View>
    </AccountCard>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 82, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  brandBox: { width: 46, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  mastercard: { color: '#FF6B4A', fontSize: 23, letterSpacing: -7, fontWeight: '900', marginLeft: -5 },
  visa: { color: colors.accent, fontSize: 13, fontWeight: '900', letterSpacing: -0.8 },
  revolut: { color: colors.text, fontSize: 25, lineHeight: 29, fontWeight: '900' },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: typography.size.body, lineHeight: typography.lineHeight.body, fontWeight: typography.weight.black },
  subtitle: { fontSize: typography.size.caption, lineHeight: typography.lineHeight.caption, fontWeight: typography.weight.medium },
  actions: { alignItems: 'flex-end', gap: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  badgeActive: { backgroundColor: colors.accent },
  badgeText: { fontSize: typography.size.badge, lineHeight: typography.lineHeight.badge, fontWeight: typography.weight.black },
  removeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
