import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/core/design';
import AccountCard from './AccountCard';

type Props = {
  brand: 'mastercard' | 'apple' | 'revolut';
  title: string;
  subtitle: string;
  badge?: string;
};

export default function PaymentCard({ brand, title, subtitle, badge }: Props) {
  return (
    <AccountCard style={styles.card}>
      <View style={styles.brandBox}>
        {brand === 'mastercard' ? <Text style={styles.mastercard}>●●</Text> : null}
        {brand === 'apple' ? <Ionicons name="logo-apple" size={24} color={colors.text} /> : null}
        {brand === 'revolut' ? <Text style={styles.revolut}>R</Text> : null}
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : <Ionicons name="chevron-forward" size={18} color="rgba(248,251,255,0.46)" />}
    </AccountCard>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 76, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  brandBox: { width: 46, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  mastercard: { color: '#FF6B4A', fontSize: 23, letterSpacing: -7, fontWeight: '900', marginLeft: -5 },
  revolut: { color: colors.text, fontSize: 25, lineHeight: 29, fontWeight: '900' },
  textBlock: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: typography.size.body, lineHeight: typography.lineHeight.body, fontWeight: typography.weight.black },
  subtitle: { color: colors.muted, fontSize: typography.size.caption, lineHeight: typography.lineHeight.caption, fontWeight: typography.weight.medium },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.accent },
  badgeText: { color: colors.textInverse, fontSize: typography.size.badge, lineHeight: typography.lineHeight.badge, fontWeight: typography.weight.black },
});
