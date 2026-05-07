import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

import AccountCard from './AccountCard';
import AccountListItem from './AccountListItem';

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

export default function AccountMenu({ onOpenProfile, onOpenPayment, onOpenSettings, onOpenHelp, onOpenLegal }: Props) {
  const items: Item[] = [
    { title: 'Profilis', subtitle: 'Pildyti ir saugoti asmeninę informaciją', icon: 'account-outline', onPress: onOpenProfile },
    { title: 'Mokėjimo būdai', subtitle: 'Saugūs mokėjimo tokenai ir Apple Pay', icon: 'credit-card-outline', onPress: onOpenPayment },
    { title: 'Nustatymai', subtitle: 'Kalba, tema, pranešimai ir automatiniai mokėjimai', icon: 'cog-outline', onPress: onOpenSettings },
    { title: 'Pagalba ir atsiliepimai', subtitle: 'Atsiliepimai, problemos, DUK ir kontaktai', icon: 'help-circle-outline', onPress: onOpenHelp },
    { title: 'Teisinė informacija', subtitle: 'Privatumo politika, sąlygos ir kontaktai', icon: 'file-document-check-outline', onPress: onOpenLegal },
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
