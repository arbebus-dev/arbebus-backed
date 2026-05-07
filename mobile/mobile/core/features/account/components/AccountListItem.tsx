import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, typography } from '@/core/design';

type Props = {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  ionIcon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  style?: ViewStyle;
  isLast?: boolean;
};

export default function AccountListItem({
  title,
  subtitle,
  value,
  icon,
  ionIcon,
  onPress,
  danger,
  right,
  style,
  isLast,
}: Props) {
  const Content = (
    <>
      {icon || ionIcon ? (
        <View style={[styles.iconBox, danger && styles.dangerIconBox]}>
          {icon ? <MaterialCommunityIcons name={icon} size={19} color={danger ? colors.danger : colors.accent} /> : null}
          {ionIcon ? <Ionicons name={ionIcon} size={19} color={danger ? colors.danger : colors.accent} /> : null}
        </View>
      ) : null}
      <View style={styles.textBlock}>
        <Text style={[styles.title, danger && styles.dangerText]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={danger ? colors.danger : 'rgba(248,251,255,0.46)'} /> : null)}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={[styles.row, !isLast && styles.border, style]}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
      >
        {Content}
      </Pressable>
    );
  }

  return <View style={[styles.row, !isLast && styles.border, style]}>{Content}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 66,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.075)',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(55,245,174,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(55,245,174,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconBox: {
    backgroundColor: 'rgba(255,118,118,0.10)',
    borderColor: 'rgba(255,118,118,0.25)',
  },
  textBlock: { flex: 1, gap: 2 },
  title: {
    color: colors.text,
    fontSize: typography.size.rowTitle,
    lineHeight: typography.lineHeight.rowTitle,
    fontWeight: typography.weight.black,
    letterSpacing: -0.25,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.medium,
  },
  value: {
    maxWidth: 150,
    color: colors.muted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.medium,
    textAlign: 'right',
  },
  dangerText: { color: colors.danger },
});
