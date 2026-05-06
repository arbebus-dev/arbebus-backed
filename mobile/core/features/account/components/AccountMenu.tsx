import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

import AccountCard from './AccountCard';
import AccountListItem from './AccountListItem';

type Props = {
  onOpenProfile: () => void;
  onOpenPayment: () => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
  onOpenLegal: () => void;
};

type Item = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
};

export default function AccountMenu({ onOpenProfile, onOpenPayment, onOpenSettings, onOpenFeedback, onOpenLegal }: Props) {
  const items: Item[] = [
    { title: 'Profilis', subtitle: 'Asmeninė informacija', icon: 'account-outline', onPress: onOpenProfile },
    { title: 'Mokėjimo būdai', subtitle: 'Kortelės, Apple Pay ir kt.', icon: 'credit-card-outline', onPress: onOpenPayment },
    { title: 'Nustatymai', subtitle: 'Programėlės nustatymai', icon: 'cog-outline', onPress: onOpenSettings },
    { title: 'Pranešimai', subtitle: 'Įspėjimai ir pranešimų nustatymai', icon: 'bell-outline', onPress: onOpenFeedback },
    { title: 'Pagalba', subtitle: 'DUK ir klientų aptarnavimas', icon: 'help-circle-outline', onPress: onOpenFeedback },
    { title: 'Teisinė informacija', subtitle: 'Privatumo politika ir sąlygos', icon: 'file-document-check-outline', onPress: onOpenLegal },
  ];

  return (
    <AccountCard>
      {items.map((item, index) => (
        <AccountListItem
          key={item.title}
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
