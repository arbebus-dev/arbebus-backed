import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  bg: '#050A12',
  card: 'rgba(8,18,32,0.94)',
  card2: 'rgba(16,32,51,0.88)',
  border: 'rgba(55,245,174,0.22)',
  accent: '#37F5AE',
  text: '#F8FBFF',
  muted: '#9CA8B8',
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
    shadowColor: '#37F5AE',
    shadowOpacity: 0.10,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
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
