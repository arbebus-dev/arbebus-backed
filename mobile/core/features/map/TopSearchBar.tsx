import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { LINE_HEIGHT, T } from "@/core/theme/typography";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

type Props = {
  value: string;
  isSearching?: boolean;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
};

export default function TopSearchBar({ value, isSearching, onChangeText, onSubmit, onClear }: Props) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
            shadowOpacity: theme.isLight ? 0.12 : 0.24,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.dim} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={t.common.searchPlaceholder}
          placeholderTextColor={theme.dim}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          style={[styles.input, { color: theme.text }]}
        />
        {isSearching ? <ActivityIndicator size="small" color={theme.accent} /> : null}
        {value.trim().length > 0 ? (
          <Pressable onPress={onClear} hitSlop={12} style={styles.clearButton}>
            <Ionicons name="close-circle" size={19} color={theme.dim} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", top: 58, left: 16, right: 16, zIndex: 45, elevation: 45 },
  searchBox: {
    minHeight: 52,
    borderRadius: 22,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  input: {
    flex: 1,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "700",
    paddingVertical: 11,
  },
  clearButton: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
