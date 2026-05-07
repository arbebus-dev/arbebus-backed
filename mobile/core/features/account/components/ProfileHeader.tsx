import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/core/design';
import type { UserProfile } from '../accountTypes';
import { useAccountTheme } from '../context/AppPreferencesContext';

type Props = {
  profile: UserProfile;
  onEditAvatar?: () => void;
};

function initials(profile: UserProfile) {
  const first = profile.firstName.trim()[0] || '';
  const last = profile.lastName.trim()[0] || '';
  const result = `${first}${last}`.trim();
  return result || 'A';
}

export default function ProfileHeader({ profile, onEditAvatar }: Props) {
  const theme = useAccountTheme();
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || 'Arbebus naudotojas';
  const email = profile.email || 'Įveskite el. paštą';

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onEditAvatar} style={[styles.avatar, { backgroundColor: theme.isLight ? 'rgba(52,245,174,0.18)' : 'rgba(55,245,174,0.15)' }]}> 
        {profile.avatarUri ? (
          <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.initials}>{initials(profile).toUpperCase()}</Text>
        )}
        <View style={[styles.cameraBadge, { backgroundColor: theme.surfaceStrong, borderColor: theme.border }]}> 
          <Ionicons name="camera-outline" size={13} color={theme.text} />
        </View>
      </Pressable>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]}>{fullName}</Text>
        <Text style={[styles.email, { color: theme.muted }]}>{email}</Text>
        <View style={styles.proBadge}><Text style={styles.proText}>PRO READY</Text></View>
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
    borderWidth: 1,
    borderColor: 'rgba(55,245,174,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 82, height: 82, borderRadius: 41 },
  initials: { color: colors.accent, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  cameraBadge: {
    position: 'absolute',
    right: -1,
    bottom: 3,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  info: { flex: 1 },
  name: { fontSize: typography.size.title, lineHeight: typography.lineHeight.title, fontWeight: typography.weight.black, letterSpacing: -0.3 },
  email: { fontSize: typography.size.body, lineHeight: typography.lineHeight.body, fontWeight: typography.weight.medium, marginTop: 2 },
  proBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: 'rgba(55,245,174,0.16)', borderWidth: 1, borderColor: 'rgba(55,245,174,0.22)' },
  proText: { color: colors.accent, fontSize: typography.size.badge, lineHeight: typography.lineHeight.badge, fontWeight: typography.weight.black, letterSpacing: 0.7 },
});
