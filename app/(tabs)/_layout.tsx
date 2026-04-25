import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

function TabBarIcon({ focused }: { focused: boolean }) {
  return <Ionicons name="map" size={24} color={focused ? "#69E1FF" : "#8E96B2"} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#69E1FF",
        tabBarInactiveTintColor: "#8E96B2",
        tabBarStyle: {
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 12,
          height: 68,
          borderTopWidth: 0,
          borderRadius: 26,
          backgroundColor: "rgba(6, 10, 20, 0.94)",
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 22,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", marginTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Travel", tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} /> }}
      />
    </Tabs>
  );
}
