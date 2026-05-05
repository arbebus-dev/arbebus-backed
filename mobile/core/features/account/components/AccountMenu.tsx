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
  const items: Array<{ key: AccountMenuKey; icon: any; title: string }> = [
    { key: "profile", icon: "account-outline", title: t.account.profile },
    { key: "payment", icon: "credit-card-outline", title: t.account.payment },
    { key: "settings", icon: "cog-outline", title: t.account.settings },
    { key: "feedback", icon: "message-text-outline", title: t.account.feedback },
    { key: "legal", icon: "file-document-check-outline", title: t.account.legal },
  ];

  return (
    <View style={styles.menu}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={styles.row}
          onPress={() => {
            void Haptics.selectionAsync();
            onSelect(item.key);
          }}
        >
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={item.icon} size={27} color="#111827" />
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Ionicons name="chevron-forward" size={24} color="rgba(17,24,39,0.28)" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    gap: 24,
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 52,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    color: "#111827",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.35,
  },
});
