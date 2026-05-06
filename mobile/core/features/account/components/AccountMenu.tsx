import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '@/core/design';

type Item = {
  id: string;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
};

type Props = {
  onOpenProfile: () => void;
  onOpenPayment: () => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
  onOpenLegal: () => void;
};

const COLORS = {
  bg: colors.background,
  card: colors.surface,
  card2: colors.surfaceStrong,
  border: colors.borderAccent,
  accent: colors.accent,
  text: colors.text,
  muted: colors.muted,
  chevron: 'rgba(248,251,255,0.42)',
};

export default function AccountMenu({
  onOpenProfile,
  onOpenPayment,
  onOpenSettings,
  onOpenFeedback,
  onOpenLegal,
}: Props) {
  const items: Item[] = [
    { id: 'profile', title: 'Profilis', icon: 'account-outline', onPress: onOpenProfile },
    { id: 'payment', title: 'Mokėjimo būdai', icon: 'credit-card-outline', onPress: onOpenPayment },
    { id: 'settings', title: 'Nustatymai', icon: 'cog-outline', onPress: onOpenSettings },
    { id: 'feedback', title: 'Padėk mums tobulėti', icon: 'message-text-outline', onPress: onOpenFeedback },
    { id: 'legal', title: 'Teisinė informacija', icon: 'file-document-check-outline', onPress: onOpenLegal },
  ];

  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          style={[styles.row, index !== items.length - 1 && styles.rowBorder]}
          onPress={() => {
            void Haptics.selectionAsync();
            item.onPress();
          }}
        >
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name={item.icon} size={23} color={COLORS.accent} />
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Ionicons name="chevron-forward" size={21} color={COLORS.chevron} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    minHeight: 76,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(55,245,174,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(55,245,174,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
});
