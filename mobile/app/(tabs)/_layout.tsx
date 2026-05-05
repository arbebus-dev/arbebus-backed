import { Tabs } from "expo-router";

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#03070B" },
        tabBarActiveTintColor: "white",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Keliauti" }} />
      <Tabs.Screen name="explore" options={{ title: "Paskyra" }} />
    </Tabs>
  );
}
