import React from "react";
import { Pressable, Text, View } from "react-native";
import { PRO_PRICE } from "../../constants/home";
import styles from "../../styles";
import UltraPressable from "../ui/UltraPressable";

type PaywallCopy = {
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
};

type Props = {
  visible: boolean;
  paywallCopy: PaywallCopy;
  onPurchase: () => void | Promise<void>;
  onDemoUnlock: () => void | Promise<void>;
  onClose: () => void | Promise<void>;
};

export default function HomePaywall({
  visible,
  paywallCopy,
  onPurchase,
  onDemoUnlock,
  onClose,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.paywallOverlay}>
      <View style={styles.paywallCard}>
        <View style={styles.paywallGlow} />
        <View style={styles.paywallBadge}>
          <Text style={styles.paywallBadgeText}>{paywallCopy.badge}</Text>
        </View>

        <Text style={styles.paywallTitle}>{paywallCopy.title}</Text>
        <Text style={styles.paywallSubtitle}>{paywallCopy.subtitle}</Text>

        <View style={styles.paywallFeatures}>
          {paywallCopy.bullets.map((item, index) => (
            <Text key={`${item}-${index}`} style={styles.paywallFeature}>
              ✅ {item}
            </Text>
          ))}
        </View>

        <View style={styles.paywallPriceBox}>
          <Text style={styles.paywallPrice}>{PRO_PRICE}</Text>
          <Text style={styles.paywallPriceNote}>
            7 dienų nemokamas išbandymas
          </Text>
        </View>

        <UltraPressable onPress={onPurchase}>
          <View style={styles.paywallButton}>
            <Text style={styles.paywallButtonText}>Išbandyti PRO</Text>
          </View>
        </UltraPressable>

        <UltraPressable onPress={onDemoUnlock}>
          <View style={styles.paywallSecondaryButton}>
            <Text style={styles.paywallSecondaryButtonText}>Demo unlock</Text>
          </View>
        </UltraPressable>

        <Pressable onPress={onClose}>
          <Text style={styles.paywallClose}>Tęsti nemokamai</Text>
        </Pressable>
      </View>
    </View>
  );
}