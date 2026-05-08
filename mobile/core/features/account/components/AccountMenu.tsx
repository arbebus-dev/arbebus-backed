import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useLanguage } from "@/core/i18n/LanguageContext";
import AccountCard from "./AccountCard";
import AccountListItem from "./AccountListItem";

type Props = {
  onOpenProfile: () => void;
  onOpenPayment: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenLegal: () => void;
};

type Item = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
};

export default function AccountMenu({
  onOpenProfile,
  onOpenPayment,
  onOpenSettings,
  onOpenHelp,
  onOpenLegal,
}: Props) {
  const { t } = useLanguage();

  const items: Item[] = [
    {
      title: t.account.menu.profile,
      subtitle: t.account.menu.profileSubtitle,
      icon: "account-outline",
      onPress: onOpenProfile,
    },
    {
      title: t.account.menu.payment,
      subtitle: t.account.menu.paymentSubtitle,
      icon: "credit-card-outline",
      onPress: onOpenPayment,
    },
    {
      title: t.account.menu.settings,
      subtitle: t.account.menu.settingsSubtitle,
      icon: "cog-outline",
      onPress: onOpenSettings,
    },
    {
      title: t.account.menu.help,
      subtitle: t.account.menu.helpSubtitle,
      icon: "help-circle-outline",
      onPress: onOpenHelp,
    },
    {
      title: t.account.menu.legal,
      subtitle: t.account.menu.legalSubtitle,
      icon: "file-document-check-outline",
      onPress: onOpenLegal,
    },
  ];

  return (
    <AccountCard>
      {items.map((item, index) => (
        <AccountListItem
          key={`${item.title}-${index}`}
          title={item.title}
          subtitle={item.subtitle}
          icon={item.icon}
          onPress={item.onPress}
          isLast={index === items.length - 1}
        />
      ))}
    </AccountCard>
  );
}
