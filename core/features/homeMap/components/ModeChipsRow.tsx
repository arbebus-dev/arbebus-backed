import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type TravelMode =
  | "smart"
  | "bus"
  | "taxi"
  | "scooter"
  | "train"
  | "airport";

type MdiIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type ModeChipProps = {
  label: string;
  icon: MdiIconName;
  active: boolean;
  onPress: () => void;
};

type Props = {
  selectedMode: TravelMode;
  onSelectMode: (mode: TravelMode) => void;
};

function ModeChip({ label, icon, active, onPress }: ModeChipProps) {
  return (
    <Pressable onPress={onPress} style={styles.modeChipPressable}>
      <View style={[styles.modeChip, active && styles.modeChipActive]}>
        <View style={[styles.modeChipIconWrap, active && styles.modeChipIconWrapActive]}>
          <MaterialCommunityIcons
            name={icon}
            size={15}
            color={active ? "#FFFFFF" : "#AFC4EA"}
          />
        </View>

        <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function ModeChipsRow({ selectedMode, onSelectMode }: Props) {
  return (
    <View style={styles.sheetTopDragArea}>
      <View style={styles.sheetHandle} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.modeChipsHorizontalContent}
      >
        <View style={styles.modeChipHorizontalItem}>
          <ModeChip
            active={selectedMode === "smart"}
            label="Smart Route"
            icon="brain"
            onPress={() => onSelectMode("smart")}
          />
        </View>

        <View style={styles.modeChipHorizontalItem}>
          <ModeChip
            active={selectedMode === "taxi"}
            label="Taxi"
            icon="taxi"
            onPress={() => onSelectMode("taxi")}
          />
        </View>

        <View style={styles.modeChipHorizontalItem}>
          <ModeChip
            active={selectedMode === "scooter"}
            label="Scooter"
            icon="scooter"
            onPress={() => onSelectMode("scooter")}
          />
        </View>

        <View style={styles.modeChipHorizontalItem}>
          <ModeChip
            active={selectedMode === "bus"}
            label="Bus"
            icon="bus"
            onPress={() => onSelectMode("bus")}
          />
        </View>

        <View style={styles.modeChipHorizontalItem}>
          <ModeChip
            active={selectedMode === "train"}
            label="Train"
            icon="train"
            onPress={() => onSelectMode("train")}
          />
        </View>

        <View style={styles.modeChipHorizontalItem}>
          <ModeChip
            active={selectedMode === "airport"}
            label="Airport"
            icon="airplane"
            onPress={() => onSelectMode("airport")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetTopDragArea: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: "#07162F",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },

  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    marginBottom: 10,
  },

  modeChipsHorizontalContent: {
    paddingRight: 8,
  },

  modeChipHorizontalItem: {
    width: 150,
    marginRight: 8,
  },

  modeChipPressable: {
    flex: 1,
  },

  modeChip: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.045)",
  },

  modeChipActive: {
    backgroundColor: "rgba(59,130,246,0.18)",
    borderColor: "rgba(96,165,250,0.55)",
  },

  modeChipIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 6,
  },

  modeChipIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  modeChipText: {
    color: "#D8E6FF",
    fontSize: 11,
    fontWeight: "800",
    flexShrink: 1,
  },

  modeChipTextActive: {
    color: "#FFFFFF",
  },
});