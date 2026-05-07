import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppPreferences, PaymentMethod, UserProfile } from "../accountTypes";

const PROFILE_KEY = "arbebus.account.profile.v1";
const PAYMENTS_KEY = "arbebus.account.paymentMethods.v1";
const PREFS_KEY = "arbebus.account.preferences.v1";

export const DEFAULT_PROFILE: UserProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "Klaipėda",
  country: "Lietuva",
  birthDate: "",
  avatarUri: null,
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  language: "lt",
  themeMode: "dark",
  notificationsEnabled: true,
  tripAlerts: true,
  delayAlerts: true,
  leaveReminders: true,
  paymentNotifications: true,
  autoPayments: false,
  notificationSound: "default",
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

export async function loadUserProfile(): Promise<UserProfile> {
  return parseJson<UserProfile>(await AsyncStorage.getItem(PROFILE_KEY), DEFAULT_PROFILE);
}

export async function saveUserProfile(profile: UserProfile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export async function loadPaymentMethods(): Promise<PaymentMethod[]> {
  const raw = await AsyncStorage.getItem(PAYMENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePaymentMethods(methods: PaymentMethod[]) {
  await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(methods));
  return methods;
}

export async function loadAppPreferences(): Promise<AppPreferences> {
  return parseJson<AppPreferences>(await AsyncStorage.getItem(PREFS_KEY), DEFAULT_PREFERENCES);
}

export async function saveAppPreferences(preferences: AppPreferences) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  return preferences;
}
