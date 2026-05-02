// components/map/RoutePointMarker.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  coordinate: Coordinate;
  type: "pickup" | "destination";
  title?: string;
  subtitle?: string;
};

export default function RoutePointMarker({
  coordinate,
  type,
  title,
  subtitle,
}: Props) {
  const isPickup = type === "pickup";

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.92 }}>
      <View style={styles.wrap}>
        <View style={styles.labelShadow} />
        <View
          style={[
            styles.labelCard,
            isPickup ? styles.pickupCard : styles.destinationCard,
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              isPickup ? styles.pickupIconWrap : styles.destinationIconWrap,
            ]}
          >
            {isPickup ? (
              <Ionicons name="navigate" size={14} color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name="map-marker-radius"
                size={15}
                color="#FFFFFF"
              />
            )}
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.eyebrow}>
              {isPickup ? "PICKUP" : "DESTINATION"}
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {title || (isPickup ? "Pickup" : "Destination")}
            </Text>
            {!!subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.pinWrap}>
          <View
            style={[
              styles.pinOuter,
              isPickup ? styles.pickupPinOuter : styles.destinationPinOuter,
            ]}
          >
            <View
              style={[
                styles.pinInner,
                isPickup ? styles.pickupPinInner : styles.destinationPinInner,
              ]}
            />
          </View>
          <View
            style={[
              styles.pinStem,
              isPickup ? styles.pickupPinStem : styles.destinationPinStem,
            ]}
          />
          <View style={styles.pinShadow} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    minWidth: 122,
  },
  labelShadow: {
    position: "absolute",
    top: 8,
    width: 118,
    height: 42,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.18)",
    transform: [{ scale: 1.03 }],
  },
  labelCard: {
    maxWidth: 182,
    minWidth: 116,
    borderRadius: 20,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  pickupCard: {
    backgroundColor: "rgba(8,16,31,0.96)",
    borderColor: "rgba(96,165,250,0.26)",
  },
  destinationCard: {
    backgroundColor: "rgba(8,16,31,0.96)",
    borderColor: "rgba(52,211,153,0.26)",
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  pickupIconWrap: {
    backgroundColor: "#3B82F6",
  },
  destinationIconWrap: {
    backgroundColor: "#10B981",
  },
  textWrap: {
    flexShrink: 1,
    maxWidth: 130,
  },
  eyebrow: {
    color: "#8FA5C7",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9FB1CC",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  pinWrap: {
    alignItems: "center",
    marginTop: -1,
  },
  pinOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    backgroundColor: "#08101F",
  },
  pickupPinOuter: {
    borderColor: "#60A5FA",
  },
  destinationPinOuter: {
    borderColor: "#34D399",
  },
  pinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pickupPinInner: {
    backgroundColor: "#60A5FA",
  },
  destinationPinInner: {
    backgroundColor: "#34D399",
  },
  pinStem: {
    width: 3,
    height: 12,
    borderRadius: 2,
    marginTop: -1,
  },
  pickupPinStem: {
    backgroundColor: "#60A5FA",
  },
  destinationPinStem: {
    backgroundColor: "#34D399",
  },
  pinShadow: {
    width: 16,
    height: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginTop: 2,
  },
});