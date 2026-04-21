import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Tab = "home" | "menu" | "wallet" | "pay" | "rides";

export function BottomTabBar({ activeTab }: { activeTab: Tab }) {
  const router = useRouter();

  const handlePress = (tab: Tab) => {
    switch (tab) {
      case "home":
        router.push("/");
        break;
      case "menu":
        router.push("/menu");
        break;
      case "wallet":
        router.push("/wallet");
        break;
      case "pay":
        router.push("/pay");
        break;
      case "rides":
        router.push("/rides");
        break;
    }
  };

  const renderTab = (
    tab: Tab,
    icon: keyof typeof Ionicons.glyphMap,
    label: string
  ) => {
    const isActive = activeTab === tab;

    return (
      <Pressable
        key={tab}
        onPress={() => handlePress(tab)}
        style={styles.tab}
      >
        <Ionicons
          name={icon}
          size={22}
          color={isActive ? "#FFFFFF" : "#8EA6CC"}
        />
        <Text style={[styles.label, isActive && styles.labelActive]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {renderTab("home", "home-outline", "Home")}
      {renderTab("menu", "grid-outline", "Menu")}
      {renderTab("wallet", "wallet-outline", "Wallet")}
      {renderTab("pay", "card-outline", "Pay")}
      {renderTab("rides", "car-outline", "Rides")}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    height: 70,
    borderRadius: 24,
    backgroundColor: "#0B172A",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  tab: {
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    fontSize: 10,
    color: "#8EA6CC",
    marginTop: 4,
  },

  labelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});