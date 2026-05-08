import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useState } from "react";
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
import AccountCard from "../components/AccountCard";
import AccountListItem from "../components/AccountListItem";
import { useAccountTheme } from "../context/AppPreferencesContext";

type Props = { onBack: () => void };

const SUPPORT_EMAIL = "arbebus@gmail.com";

export default function HelpScreen({ onBack }: Props) {
  const theme = useAccountTheme();
  const { t } = useLanguage();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [message, setMessage] = useState("");

  const sendMail = async (subject: string, body = "") => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
    else Alert.alert(t.account.help.contactAlertTitle, SUPPORT_EMAIL);
  };

  const submitFeedback = async () => {
    if (!message.trim()) {
      Alert.alert(
        t.account.help.feedbackAlertTitle,
        t.account.help.missingMessage,
      );
      return;
    }
    await sendMail("Arbebus atsiliepimas", message.trim());
    setMessage("");
    setFeedbackOpen(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            {t.account.help.title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.section, { color: theme.muted }]}>
          {t.account.help.sectionHelp}
        </Text>
        <AccountCard>
          <AccountListItem
            title={t.account.help.sendFeedback}
            subtitle={t.account.help.feedbackSubtitle}
            ionIcon="chatbox-ellipses-outline"
            onPress={() => setFeedbackOpen(true)}
          />
          <AccountListItem
            title={t.account.help.reportIssue}
            subtitle={t.account.help.reportIssueSubtitle}
            ionIcon="bug-outline"
            onPress={() => sendMail("Arbebus problema")}
          />
          <AccountListItem
            title={t.account.help.faq}
            subtitle={t.account.help.faqSubtitle}
            ionIcon="help-circle-outline"
            onPress={() =>
              Alert.alert(
                t.account.help.faq,
                "DUK puslapis bus jungiamas per arbebus.com/help.",
              )
            }
            isLast
          />
        </AccountCard>

        <Text style={[styles.section, { color: theme.muted }]}>
          {t.account.help.contacts}
        </Text>
        <AccountCard>
          <AccountListItem
            title={t.account.help.email}
            value={SUPPORT_EMAIL}
            ionIcon="mail-outline"
            onPress={() => sendMail("Arbebus kontaktai")}
            isLast
          />
        </AccountCard>
      </ScrollView>

      <Modal
        visible={feedbackOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFeedbackOpen(false)}
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
              {t.account.help.feedbackModalTitle}
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder={t.account.help.feedbackPlaceholder}
              placeholderTextColor={theme.dim}
              style={[
                styles.messageInput,
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
                onPress={() => setFeedbackOpen(false)}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: theme.text }]}
                >
                  {t.account.help.cancel}
                </Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitFeedback}>
                <Text style={styles.primaryButtonText}>
                  {t.account.help.send}
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
  headerTitle: {
    flex: 1,
    fontSize: typography.size.screenTitle,
    lineHeight: typography.lineHeight.screenTitle,
    fontWeight: typography.weight.black,
    textAlign: "center",
  },
  headerSpacer: { width: 38 },
  section: {
    fontSize: typography.size.section,
    lineHeight: typography.lineHeight.section,
    fontWeight: typography.weight.black,
    letterSpacing: 1.7,
    marginTop: 16,
    marginBottom: 10,
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
    marginBottom: 14,
    textAlign: "center",
  },
  messageInput: {
    minHeight: 136,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 18 },
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
