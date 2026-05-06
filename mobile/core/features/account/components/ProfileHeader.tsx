import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/core/design';

export default function ProfileHeader() {
  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <Ionicons name="person-outline" size={38} color={colors.accent} />
        <View style={styles.cameraBadge}>
          <Ionicons name="camera-outline" size={13} color={colors.text} />
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>Vardas Pavardė</Text>
        <Text style={styles.email}>vardas@example.com</Text>
        <View style={styles.proBadge}><Text style={styles.proText}>PRO</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12, marginBottom: 24 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(55,245,174,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(55,245,174,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -1,
    bottom: 3,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,32,48,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: typography.size.title, lineHeight: typography.lineHeight.title, fontWeight: typography.weight.black, letterSpacing: -0.3 },
  email: { color: colors.muted, fontSize: typography.size.body, lineHeight: typography.lineHeight.body, fontWeight: typography.weight.medium, marginTop: 2 },
  proBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: 'rgba(55,245,174,0.16)', borderWidth: 1, borderColor: 'rgba(55,245,174,0.22)' },
  proText: { color: colors.accent, fontSize: typography.size.badge, lineHeight: typography.lineHeight.badge, fontWeight: typography.weight.black, letterSpacing: 0.7 },
});
