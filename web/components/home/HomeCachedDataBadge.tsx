import React from "react";
import { Text, View } from "react-native";
import styles from "../../styles";

type Props = {
  visible: boolean;
  lastUpdate?: string | null;
};

function HomeCachedDataBadge({ visible, lastUpdate }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.cachedBadge}>
      <Text style={styles.cachedBadgeText}>
        Cached data{lastUpdate ? ` • ${lastUpdate}` : ""}
      </Text>
    </View>
  );
}

export default React.memo(HomeCachedDataBadge);