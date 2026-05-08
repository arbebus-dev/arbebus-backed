import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, typography } from "@/core/design";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { PaymentMethod, PaymentMethodBrand } from "../accountTypes";
import AccountCard from "../components/AccountCard";
import PaymentCard from "../components/PaymentCard";
import SettingsToggle from "../components/SettingsToggle";
import {
    useAccountTheme,
    useAppPreferences,
} from "../context/AppPreferencesContext";
import {
    loadPaymentMethods,
    savePaymentMethods,
} from "../services/accountStorage";

type Props = { onBack: () => void };

const brands: {
  label: string;
  value: PaymentMethodBrand;
  provider: PaymentMethod["provider"];
}[] = [
  { label: "Visa", value: "visa", provider: "stripe" },
  { label: "Mastercard", value: "mastercard", provider: "stripe" },
  { label: "Apple Pay", value: "apple", provider: "apple_pay" },
  { label: "Revolut Pay", value: "revolut", provider: "revolut" },
  { label: "Banko kortelė", value: "bank", provider: "bank" },
];

export default function PaymentMethodsScreen({ onBack }: Props) {
  const theme = useAccountTheme();
  const { t } = useLanguage();
  const { preferences, setPreference } = useAppPreferences();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [brand, setBrand] = useState(brands[0]);
  const [last4, setLast4] = useState("");
  const [expiry, setExpiry] = useState("");

  useEffect(() => {
    let mounted = true;
    loadPaymentMethods().then((items) => {
      if (mounted) setMethods(items);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = async (next: PaymentMethod[]) => {
    setMethods(next);
    await savePaymentMethods(next);
  };

  const addMethod = async () => {
    const sanitizedLast4 = last4.replace(/\D/g, "").slice(-4);
    if (
      (brand.value === "visa" ||
        brand.value === "mastercard" ||
        brand.value === "bank") &&
      sanitizedLast4.length !== 4
    ) {
      Alert.alert(
        t.account.payment.title,
        "Enter the last 4 card digits. We do not store the full card number in the app.",
      );
      return;
    }

    const id = `pm_${Date.now()}`;
    const item: PaymentMethod = {
      id,
      brand: brand.value,
      title: brand.label,
      last4: sanitizedLast4 || undefined,
      expiry: expiry.trim() || undefined,
      provider: brand.provider,
      paymentMethodId: `${brand.provider}_${id}`,
      isDefault: methods.length === 0,
      createdAt: new Date().toISOString(),
    };

    const next = methods.length === 0 ? [item] : [...methods, item];
    await persist(next);
    setModalOpen(false);
    setLast4("");
    setExpiry("");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const setDefault = async (id: string) => {
    await persist(
      methods.map((method) => ({ ...method, isDefault: method.id === id })),
    );
  };

  const removeMethod = (id: string) => {
    Alert.alert(
      "Pašalinti mokėjimo būdą?",
      "Mokėjimo tokenas bus pašalintas iš šio įrenginio.",
      [
        { text: "Atšaukti", style: "cancel" },
        {
          text: "Pašalinti",
          style: "destructive",
          onPress: () => {
            const filtered = methods.filter((method) => method.id !== id);
            const hasDefault = filtered.some((method) => method.isDefault);
            const next =
              hasDefault || filtered.length === 0
                ? filtered
                : filtered.map((method, index) => ({
                    ...method,
                    isDefault: index === 0,
                  }));
            void persist(next);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={14}
            style={[
              styles.backButton,
              { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
            ]}
          >
            <Ionicons name="chevron-back" size={21} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t.account.payment.title}
          </Text>
          <Pressable
            style={styles.addButton}
            onPress={() => setModalOpen(true)}
          >
            <Ionicons name="add" size={22} color={colors.textInverse} />
          </Pressable>
        </View>

        <Text style={[styles.section, { color: theme.muted }]}>
          {t.account.payment.secureMethods}
        </Text>
        {methods.length ? (
          methods.map((method) => (
            <PaymentCard
              key={method.id}
              method={method}
              onSetDefault={() => setDefault(method.id)}
              onRemove={() => removeMethod(method.id)}
            />
          ))
        ) : (
          <AccountCard style={styles.emptyCard}>
            <Ionicons name="card-outline" size={30} color={colors.accent} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t.account.payment.noMethodsTitle}
            </Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              {t.account.payment.noMethodsDescription}
            </Text>
          </AccountCard>
        )}

        <Text style={[styles.section, { color: theme.muted, marginTop: 16 }]}>
          {t.account.payment.autoPayments}
        </Text>
        <AccountCard>
          <SettingsToggle
            title={t.account.payment.autoPayments}
            subtitle={t.account.payment.autoPaymentsSubtitle}
            value={preferences.autoPayments}
            onValueChange={(value) => setPreference("autoPayments", value)}
            isLast
          />
        </AccountCard>

        <Text style={[styles.secure, { color: theme.muted }]}>
          🔒 Saugome tik mokėjimo būdo tokeną, brand, last4 ir galiojimą. Pilno
          kortelės numerio Arbebus programėlė nesaugo.
        </Text>
      </ScrollView>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.backgroundElevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Pridėti mokėjimo būdą
            </Text>
            <View style={styles.brandGrid}>
              {brands.map((item) => (
                <Pressable
                  key={item.value}
                  style={[
                    styles.brandChip,
                    {
                      backgroundColor:
                        brand.value === item.value
                          ? colors.accent
                          : theme.surfaceSoft,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setBrand(item)}
                >
                  <Text
                    style={[
                      styles.brandChipText,
                      {
                        color:
                          brand.value === item.value
                            ? colors.textInverse
                            : theme.text,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={last4}
              onChangeText={setLast4}
              keyboardType="number-pad"
              maxLength={4}
              placeholder={t.account.payment.last4Placeholder}
              placeholderTextColor={theme.dim}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                },
              ]}
            />
            <TextInput
              value={expiry}
              onChangeText={setExpiry}
              placeholder={t.account.payment.expiryPlaceholder}
              placeholderTextColor={theme.dim}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { backgroundColor: theme.surfaceSoft },
                ]}
                onPress={() => setModalOpen(false)}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: theme.text }]}
                >
                  {t.account.payment.cancel}
                </Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={addMethod}>
                <Text style={styles.primaryButtonText}>
                  {t.account.payment.save}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 118 },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 34,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.size.screenTitle,
    lineHeight: typography.lineHeight.screenTitle,
    fontWeight: typography.weight.black,
    textAlign: "center",
  },
  section: {
    fontSize: typography.size.section,
    lineHeight: typography.lineHeight.section,
    fontWeight: typography.weight.black,
    letterSpacing: 1.7,
    marginBottom: 12,
  },
  emptyCard: {
    minHeight: 150,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.black,
  },
  emptyText: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.medium,
    textAlign: "center",
  },
  secure: {
    marginTop: 14,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.medium,
    textAlign: "center",
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 38,
  },
  modalTitle: {
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.black,
    marginBottom: 16,
    textAlign: "center",
  },
  brandGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  brandChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  brandChipText: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.black,
  },
  input: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 15,
    marginBottom: 10,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  secondaryButtonText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.black,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: typography.size.body,
    fontWeight: typography.weight.black,
  },
});
