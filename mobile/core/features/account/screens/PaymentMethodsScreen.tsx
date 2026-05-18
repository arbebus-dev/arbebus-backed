import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useStripe } from "@stripe/stripe-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

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
import {
  createPayseraPayment,
  createStripePaymentIntent,
  createStripeSetupIntent,
} from "../services/paymentsApi";

type Props = { onBack: () => void };

type PaymentProvider = "stripe" | "paysera";

type PaymentOption = {
  label: string;
  subtitle: string;
  value: PaymentMethodBrand;
  provider: PaymentProvider;
  storageProvider: PaymentMethod["provider"];
  icon: keyof typeof Ionicons.glyphMap;
};

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    label: "Visa / Mastercard",
    subtitle: "Kortelės ir Apple Pay per Stripe",
    value: "visa",
    provider: "stripe",
    storageProvider: "stripe",
    icon: "card-outline",
  },
  {
    label: "Apple Pay",
    subtitle: "Greitas mokėjimas iPhone telefone",
    value: "apple",
    provider: "stripe",
    storageProvider: "apple_pay",
    icon: "logo-apple",
  },
  {
    label: "Bankai / Paysera",
    subtitle: "Swedbank, SEB, Luminor, Citadele ir kiti bankai",
    value: "bank",
    provider: "paysera",
    storageProvider: "bank",
    icon: "business-outline",
  },
  {
    label: "Revolut Pay",
    subtitle: "Revolut / Paysera nukreipimas į banko mokėjimą",
    value: "revolut",
    provider: "paysera",
    storageProvider: "revolut",
    icon: "swap-horizontal-outline",
  },
];

const PAYMENT_AMOUNT_EUR = 2.99;

export default function PaymentMethodsScreen({ onBack }: Props) {
  const theme = useAccountTheme();
  const { t } = useLanguage();
  const { preferences, setPreference } = useAppPreferences();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [pendingOption, setPendingOption] = useState<PaymentOption | null>(null);

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

  const saveTokenPlaceholder = async (option: PaymentOption, paymentId: string) => {
    const id = `pm_${Date.now()}`;
    const item: PaymentMethod = {
      id,
      brand: option.value,
      title: option.label,
      provider: option.storageProvider,
      paymentMethodId: paymentId,
      isDefault: methods.length === 0,
      createdAt: new Date().toISOString(),
    };

    const next = methods.length === 0 ? [item] : [...methods, item];
    await persist(next);
  };

  const saveStripePaymentMethod = async (option: PaymentOption) => {
    const { clientSecret, setupIntentId } = await createStripeSetupIntent();

    const init = await initPaymentSheet({
      merchantDisplayName: "Arbebus",
      setupIntentClientSecret: clientSecret,
      applePay: {
        merchantCountryCode: "LT",
      },
      returnURL: "arbebus://stripe-redirect",
    });

    if (init.error) throw new Error(init.error.message);

    const result = await presentPaymentSheet();
    if (result.error) throw new Error(result.error.message);

    await saveTokenPlaceholder(option, setupIntentId);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Mokėjimo būdas pridėtas", "Stripe saugiai išsaugojo mokėjimo būdą.");
  };

  const makeStripePayment = async (option: PaymentOption) => {
    const { clientSecret, paymentIntentId } = await createStripePaymentIntent({
      amount: PAYMENT_AMOUNT_EUR,
      currency: "eur",
      description: "Arbebus mokėjimas",
      metadata: { source: "payment_methods_screen" },
    });

    const init = await initPaymentSheet({
      merchantDisplayName: "Arbebus",
      paymentIntentClientSecret: clientSecret,
      allowsDelayedPaymentMethods: true,
      applePay: {
        merchantCountryCode: "LT",
      },
      returnURL: "arbebus://stripe-redirect",
    });

    if (init.error) throw new Error(init.error.message);

    const result = await presentPaymentSheet();
    if (result.error) throw new Error(result.error.message);

    await saveTokenPlaceholder(option, paymentIntentId);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Mokėjimas sėkmingas", "Mokėjimo būdas aktyvuotas Arbebus programėlėje.");
  };

  const openPaysera = async (option: PaymentOption) => {
    const payment = await createPayseraPayment({
      amount: PAYMENT_AMOUNT_EUR,
      currency: "EUR",
      description: "Arbebus mokėjimas",
    });

    setPendingOption(option);
    setWebUrl(payment.url);
  };

  const handleOption = async (option: PaymentOption) => {
    try {
      setLoading(true);
      if (option.provider === "stripe") {
        await makeStripePayment(option);
      } else {
        await openPaysera(option);
      }
      setModalOpen(false);
    } catch (error: any) {
      Alert.alert("Mokėjimo klaida", error?.message || "Bandykite dar kartą.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveForLater = async () => {
    try {
      setLoading(true);
      await saveStripePaymentMethod(PAYMENT_OPTIONS[0]);
      setModalOpen(false);
    } catch (error: any) {
      Alert.alert("Mokėjimo klaida", error?.message || "Nepavyko išsaugoti mokėjimo būdo.");
    } finally {
      setLoading(false);
    }
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

  const closePaysera = async (success: boolean) => {
    const option = pendingOption;
    setWebUrl(null);
    setPendingOption(null);

    if (success && option) {
      await saveTokenPlaceholder(option, `${option.provider}_${Date.now()}`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Mokėjimas sėkmingas", "Paysera mokėjimas patvirtintas.");
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={14}
            style={[styles.backButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={21} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t.account.payment.title}</Text>
          <Pressable style={styles.addButton} onPress={() => setModalOpen(true)}>
            <Ionicons name="add" size={22} color={colors.textInverse} />
          </Pressable>
        </View>

        <Text style={[styles.section, { color: theme.muted }]}>{t.account.payment.secureMethods}</Text>
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
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.account.payment.noMethodsTitle}</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>{t.account.payment.noMethodsDescription}</Text>
          </AccountCard>
        )}

        <View style={styles.quickActions}>
          {PAYMENT_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={[styles.quickButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
              onPress={() => handleOption(option)}
              disabled={loading}
            >
              <Ionicons name={option.icon} size={20} color={colors.accent} />
              <Text style={[styles.quickButtonText, { color: theme.text }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.section, { color: theme.muted, marginTop: 16 }]}>{t.account.payment.autoPayments}</Text>
        <AccountCard>
          <SettingsToggle
            title={t.account.payment.autoPayments}
            subtitle={t.account.payment.autoPaymentsSubtitle}
            value={preferences.autoPayments}
            onValueChange={(value) => setPreference("autoPayments", value)}
            isLast
          />
        </AccountCard>

        <Text style={[styles.secure, { color: theme.muted }]}>🔒 Saugome tik mokėjimo būdo tokeną, brand, last4 ir galiojimą. Pilno kortelės numerio Arbebus programėlė nesaugo.</Text>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}> 
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}> 
            <Text style={[styles.modalTitle, { color: theme.text }]}>Pridėti mokėjimo būdą</Text>
            <Text style={[styles.modalSubtitle, { color: theme.muted }]}>Pasirink realų mokėjimo tiekėją. Kortelių numerių Arbebus nesaugo.</Text>

            {PAYMENT_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                style={[styles.providerRow, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
                onPress={() => handleOption(option)}
                disabled={loading}
              >
                <View style={styles.providerIcon}>
                  <Ionicons name={option.icon} size={22} color={colors.accent} />
                </View>
                <View style={styles.providerTextWrap}>
                  <Text style={[styles.providerTitle, { color: theme.text }]}>{option.label}</Text>
                  <Text style={[styles.providerSubtitle, { color: theme.muted }]}>{option.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={19} color={theme.muted} />
              </Pressable>
            ))}

            <Pressable
              style={[styles.saveForLaterButton, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
              onPress={handleSaveForLater}
              disabled={loading}
            >
              <Text style={[styles.saveForLaterText, { color: theme.text }]}>Tik išsaugoti kortelę per Stripe</Text>
            </Pressable>

            <Pressable style={[styles.secondaryButton, { backgroundColor: theme.surfaceSoft }]} onPress={() => setModalOpen(false)}>
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{t.account.payment.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!webUrl} animationType="slide" onRequestClose={() => void closePaysera(false)}>
        <SafeAreaView style={[styles.webScreen, { backgroundColor: theme.background }]}> 
          <View style={[styles.webHeader, { borderBottomColor: theme.border }]}> 
            <Pressable onPress={() => void closePaysera(false)}>
              <Text style={styles.webClose}>Uždaryti</Text>
            </Pressable>
            <Text style={[styles.webTitle, { color: theme.text }]}>Banko mokėjimas</Text>
            <View style={{ width: 70 }} />
          </View>
          {webUrl ? (
            <WebView
              source={{ uri: webUrl }}
              startInLoadingState
              onNavigationStateChange={(nav) => {
                if (nav.url.includes("payment-success")) {
                  void closePaysera(true);
                }
                if (nav.url.includes("payment-cancel")) {
                  void closePaysera(false);
                  Alert.alert("Mokėjimas atšauktas", "Mokėjimas nebuvo atliktas.");
                }
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}
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
  quickActions: { marginTop: 16, gap: 10 },
  quickButton: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickButtonText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.black,
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
    marginBottom: 6,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textAlign: "center",
    marginBottom: 16,
  },
  providerRow: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  providerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  providerTextWrap: { flex: 1, marginHorizontal: 10 },
  providerTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.black,
  },
  providerSubtitle: {
    marginTop: 3,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.medium,
  },
  saveForLaterButton: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveForLaterText: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.black,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.black,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  webScreen: { flex: 1 },
  webHeader: {
    height: 58,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  webClose: {
    color: colors.accent,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.black,
  },
  webTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.black,
  },
});
