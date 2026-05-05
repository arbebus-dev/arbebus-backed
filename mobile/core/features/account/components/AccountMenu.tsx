import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLanguage } from "@/core/i18n/LanguageContext";

type AccountMenuKey = "profile" | "payment" | "settings" | "feedback" | "legal";

type Props = {
  onSelect: (key: AccountMenuKey) => void;
};

export default function AccountMenu({ onSelect }: Props) {
  const { t } = useLanguage();
  const items: Array<{ key: AccountMenuKey; icon: any; title: string; subtitle: string }> = [
    { key: "profile", icon: "person-circle-outline", title: t.account.profile, subtitle: t.account.profileSubtitle },
    { key: "payment", icon: "credit-card-outline", title: t.account.payment, subtitle: t.account.paymentSubtitle },
    { key: "settings", icon: "cog-outline", title: t.account.settings, subtitle: t.account.settingsSubtitle },
    { key: "feedback", icon: "message-alert-outline", title: t.account.feedback, subtitle: t.account.feedbackSubtitle },
    { key: "legal", icon: "file-document-outline", title: t.account.legal, subtitle: t.account.legalSubtitle },
  ];

  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <Pressable
          key={item.key}
          style={[styles.row, index < items.length - 1 && styles.rowBorder]}
          onPress={() => {
            void Haptics.selectionAsync();
            onSelect(item.key);
          }}
        >
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={item.icon} size={21} color="#35F2B4" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.38)" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 16, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.09)" },
  iconWrap: { width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(53,242,180,0.13)" },
  textBlock: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.58)", fontSize: 12, fontWeight: "700", marginTop: 3 },
});
