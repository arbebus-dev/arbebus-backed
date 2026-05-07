export type ThemeMode = "dark" | "light";
export type NotificationSound = "default" | "arbebus";

export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  birthDate: string;
  avatarUri?: string | null;
};

export type PaymentMethodBrand = "visa" | "mastercard" | "apple" | "revolut" | "bank" | "other";

export type PaymentMethod = {
  id: string;
  brand: PaymentMethodBrand;
  title: string;
  last4?: string;
  expiry?: string;
  provider: "apple_pay" | "stripe" | "revolut" | "bank" | "manual_token";
  paymentMethodId: string;
  isDefault: boolean;
  createdAt: string;
};

export type AppPreferences = {
  language: "lt" | "en";
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  tripAlerts: boolean;
  delayAlerts: boolean;
  leaveReminders: boolean;
  paymentNotifications: boolean;
  autoPayments: boolean;
  notificationSound: NotificationSound;
};
