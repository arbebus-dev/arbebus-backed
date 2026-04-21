import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import styles from "../../styles";

type Props = {
  visible: boolean;
};

function HomeEmptyState({ visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.emptyStateCard}>
      <MaterialCommunityIcons name="bus-stop" size={28} color="#8ED8FF" />
      <Text style={styles.emptyStateTitle}>Kol kas nėra live autobusų</Text>
      <Text style={styles.emptyStateText}>
        Pabandyk po kelių sekundžių dar kartą. Gali būti, kad live srautas dar
        kraunasi.
      </Text>
    </View>
  );
}

export default React.memo(HomeEmptyState);