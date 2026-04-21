import React from "react";
import { Text, View } from "react-native";
import styles from "../../styles";

type Props = {
  visible: boolean;
};

function HomeBackendStatus({ visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.backendStatusCard}>
      <Text style={styles.backendStatusTitle}>Backend bunda</Text>
      <Text style={styles.backendStatusText}>
        Live duomenys laikinai neprieinami. Rodom paskutinius išsaugotus duomenis,
        jei jie yra.
      </Text>
    </View>
  );
}

export default React.memo(HomeBackendStatus);