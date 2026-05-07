import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/core/design';
import PaymentCard from '../components/PaymentCard';

type Props = { onBack: () => void };

export default function PaymentMethodsScreen({ onBack }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={14} style={styles.backButton}>
            <Ionicons name="chevron-back" size={21} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Mokėjimo būdai</Text>
          <Pressable style={styles.addButton}>
            <Ionicons name="add" size={22} color={colors.textInverse} />
          </Pressable>
        </View>

        <Text style={styles.section}>SAUGOTOS KORTELĖS</Text>
        <PaymentCard brand="mastercard" title="Mastercard •••• 1234" subtitle="Galioja iki 12/27" badge="Pagrindinė" />
        <PaymentCard brand="apple" title="Apple Pay" subtitle="Pridėta" />
        <PaymentCard brand="revolut" title="Revolut Pay" subtitle="Pridėta" />

        <Text style={styles.secure}>🔒 Jūsų mokėjimo informacija yra saugiai šifruojama.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 34 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  addButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  headerTitle: { flex: 1, color: colors.text, fontSize: typography.size.screenTitle, lineHeight: typography.lineHeight.screenTitle, fontWeight: typography.weight.black, textAlign: 'center' },
  section: { color: colors.muted, fontSize: typography.size.section, lineHeight: typography.lineHeight.section, fontWeight: typography.weight.black, letterSpacing: 1.7, marginBottom: 12 },
  secure: { marginTop: 14, color: colors.muted, fontSize: typography.size.caption, lineHeight: typography.lineHeight.caption, fontWeight: typography.weight.medium, textAlign: 'center' },
});
