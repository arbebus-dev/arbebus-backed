export type AuthProvider = "guest" | "apple" | "google";

export type AuthUser = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  provider: AuthProvider;
  isGuest: boolean;
};

export type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  continueAsGuest: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<AuthUser>) => Promise<void>;
};