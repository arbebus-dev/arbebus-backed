import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import styles from "../../styles";

type Props = {
  visible: boolean;
  text?: string;
};

function HomeLoadingOverlay({
  visible,
  text = "Kraunami live duomenys...",
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="small" color="#2563EB" />
      <Text style={[styles.loadingText, { marginTop: 10 }]}>{text}</Text>
    </View>
  );
}

export default React.memo(HomeLoadingOverlay);