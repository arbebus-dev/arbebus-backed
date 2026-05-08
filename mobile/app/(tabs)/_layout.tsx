import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { useLanguage } from "@/core/i18n/LanguageContext";

const ARB = {
  bg: "rgba(5,10,18,0.96)",
  border: "rgba(55,245,174,0.18)",
  accent: "#37F5AE",
  inactive: "rgba(248,251,255,0.48)",
};

export default function TabsLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          height: 82,
          paddingTop: 8,
          paddingBottom: 20,
          backgroundColor: ARB.bg,
          borderTopWidth: 1,
          borderTopColor: ARB.border,
          shadowColor: "#37F5AE",
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -8 },
          elevation: 22,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "900",
          letterSpacing: -0.1,
        },
        tabBarActiveTintColor: ARB.accent,
        tabBarInactiveTintColor: ARB.inactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.common.tabTravel,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "navigate-circle" : "navigate-circle-outline"}
              size={Math.max(size, 27)}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t.common.tabAccount,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              size={Math.max(size, 28)}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
