import "../../core/services/alerts/leaveAlertBackground";

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

function TabBarIcon({
  focused,
  icon,
}: {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Ionicons
      name={icon}
      size={24}
      color={focused ? "#FF5A4F" : "#8E96B2"}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#FF5A4F",
        tabBarInactiveTintColor: "#8E96B2",
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 10,
          height: 72,
          borderTopWidth: 0,
          borderRadius: 26,
          backgroundColor: "rgba(10, 16, 31, 0.95)",
          paddingTop: 10,
          paddingBottom: 10,
          paddingHorizontal: 10,
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 24,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 4,
        },
        tabBarItemStyle: {
          borderRadius: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="home" />
          ),
        }}
      />

      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="grid-outline" />
          ),
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="wallet-outline" />
          ),
        }}
      />

      <Tabs.Screen
        name="news"
        options={{
          title: "News",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} icon="newspaper-outline" />
          ),
        }}
      />

      <Tabs.Screen
        name="buses"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}