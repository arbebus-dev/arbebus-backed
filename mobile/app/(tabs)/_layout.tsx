import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          height: 86,
          paddingTop: 8,
          paddingBottom: 22,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTopWidth: 0,
          shadowColor: "#000",
          shadowOpacity: 0.10,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -6 },
          elevation: 18,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "800",
        },
        tabBarActiveTintColor: "#FF0A8A",
        tabBarInactiveTintColor: "rgba(17,24,39,0.45)",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keliauti",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "navigate-circle" : "navigate-circle-outline"} size={Math.max(size, 27)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Paskyra",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={Math.max(size, 28)} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
