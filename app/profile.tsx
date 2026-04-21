import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabBar } from "../components/BottomTabBar";
import { useAuth } from "../core/auth/useAuth";

function GlassCard({ children, style }: any) {
  return (
    <View style={[styles.card, style]}>
      <BlurView
        intensity={Platform.OS === "ios" ? 30 : 20}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardInner}>{children}</View>
    </View>
  );
}

function UltraPressable({ onPress, children, style }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateUserProfile, signOut, isGuest } = useAuth();

  const [name, setName] = useState("Guest User");
  const [email, setEmail] = useState("guest@arbebus.app");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const initials = useMemo(() => {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }, [name]);

  const saveProfile = async () => {
    try {
      await updateUserProfile({
        name: name.trim(),
        email: email.trim(),
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Išsaugota", "Profilis atnaujintas");
    } catch (error) {
      console.log("saveProfile error:", error);
      Alert.alert("Klaida", "Nepavyko išsaugoti profilio");
    }
  };

  const logout = async () => {
    Alert.alert(
      isGuest ? "Išeiti iš guest režimo" : "Atsijungti",
      isGuest
        ? "Ar tikrai nori išeiti iš guest režimo?"
        : "Ar tikrai nori atsijungti?",
      [
        { text: "Atšaukti", style: "cancel" },
        {
          text: "Taip",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.push("/profile");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <UltraPressable onPress={() => router.back()}>
            <View style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </View>
          </UltraPressable>

          <Text style={styles.title}>Profile</Text>

          <UltraPressable onPress={() => router.push("/menu")}>
            <View style={styles.iconBtn}>
              <Ionicons name="grid-outline" size={20} color="#fff" />
            </View>
          </UltraPressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <GlassCard style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
            <Text style={styles.meta}>
              {user?.provider ? `Provider: ${user.provider}` : "Not signed in"}
            </Text>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>Vardas</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Tavo vardas"
              placeholderTextColor="#6B7280"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
            />
          </GlassCard>

          <GlassCard>
            <UltraPressable onPress={saveProfile}>
              <View style={styles.primaryBtn}>
                <Text style={styles.primaryText}>Išsaugoti</Text>
              </View>
            </UltraPressable>

            <UltraPressable onPress={logout}>
              <View style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>
                  {isGuest ? "Išeiti iš guest" : "Atsijungti"}
                </Text>
              </View>
            </UltraPressable>
          </GlassCard>

          <View style={{ height: 100 }} />
        </ScrollView>

        <BottomTabBar activeTab="menu" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111f",
  },

  scroll: {
    padding: 16,
    paddingBottom: 120,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    alignItems: "center",
  },

  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  cardInner: {
    padding: 16,
  },

  hero: {
    alignItems: "center",
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#4A86F7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  avatarText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },

  name: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },

  email: {
    color: "#9CA3AF",
    marginTop: 4,
  },

  meta: {
    color: "#8CCBFF",
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
  },

  label: {
    color: "#8CCBFF",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "700",
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
  },

  primaryBtn: {
    backgroundColor: "#4A86F7",
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    alignItems: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },

  secondaryBtn: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },

  secondaryText: {
    color: "#FCA5A5",
    fontWeight: "800",
  },
});