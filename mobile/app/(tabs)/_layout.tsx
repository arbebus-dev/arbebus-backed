import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { useLanguage } from "@/core/i18n/LanguageContext";

export default function TabsLayout() {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          height: 82,
          paddingTop: 8,
          paddingBottom: 20,
          backgroundColor: theme.tabBarBackground,
          borderTopWidth: 1,
          borderTopColor: theme.tabBarBorder,
          shadowColor: theme.shadow,
          shadowOpacity: theme.isLight ? 0.11 : 0.12,
          shadowRadius: theme.isLight ? 16 : 18,
          shadowOffset: { width: 0, height: -8 },
          elevation: 22,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "900",
          letterSpacing: -0.1,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.tabBarInactive,
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
