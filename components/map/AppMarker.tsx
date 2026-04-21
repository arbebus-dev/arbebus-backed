import React, { useMemo } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Marker } from "react-native-maps";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  coordinate: Coordinate;
  source: ImageSourcePropType;
  rotation?: number;
  label?: string;
  isBest?: boolean;
  onPress?: () => void;
};

export default function AppMarker({
  coordinate,
  source,
  rotation = 0,
  label,
  isBest = false,
  onPress,
}: Props) {
  const animatedRotation = useMemo(() => `${rotation}deg`, [rotation]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.86 }}
      tracksViewChanges={false}
    >
      <Pressable onPress={onPress} style={styles.pressable}>
        <View style={styles.wrap}>
          {isBest ? <View style={styles.bestGlow} /> : null}

          <Image
            source={require("../../assets/markers/bus-pin-bg.png")}
            style={styles.pinBg}
            resizeMode="contain"
          />

          <View style={styles.busSlot}>
            <View
              style={[
                styles.busRotateWrap,
                { transform: [{ rotate: animatedRotation }] },
              ]}
            >
              <Image source={source} style={styles.busIcon} resizeMode="contain" />
            </View>
          </View>

          {!!label && (
            <View style={[styles.numberPill, isBest && styles.numberPillBest]}>
              <Text style={styles.numberText} numberOfLines={1}>
                {label}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },

  wrap: {
    width: 46,
    height: 62,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  bestGlow: {
    position: "absolute",
    top: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(59, 208, 255, 0.18)",
    shadowColor: "#39D0FF",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  pinBg: {
    width: 46,
    height: 62,
  },

  busSlot: {
    position: "absolute",
    top: 7,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  busRotateWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  busIcon: {
    width: 20,
    height: 20,
  },

  numberPill: {
    position: "absolute",
    top: 28,
    minWidth: 24,
    height: 16,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: "#20BF55",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#20BF55",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },

  numberPillBest: {
    backgroundColor: "#18D95C",
  },

  numberText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
});