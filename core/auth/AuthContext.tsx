import { Session, User } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import React, { createContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { supabase, supabaseEnabled } from "./lib/supabase";
import type { AuthContextType, AuthProvider, AuthUser } from "./types";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: React.ReactNode;
};

function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};

  const provider = (appMeta.provider ?? meta.provider ?? "guest") as AuthProvider;
  const firstName = (meta.first_name ?? meta.given_name ?? null) as string | null;
  const lastName = (meta.last_name ?? meta.family_name ?? null) as string | null;
  const computedFullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName =
    (meta.full_name as string | undefined) ??
    (computedFullName.length > 0 ? computedFullName : null);

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: fullName || null,
    firstName,
    lastName,
    avatar: (meta.avatar_url ?? meta.picture ?? null) as string | null,
    provider,
    isGuest: !!appMeta.is_anonymous,
  };
}

async function upsertProfile(user: User) {
  if (!supabase) return;

  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};
  const firstName = (meta.first_name ?? meta.given_name ?? null) as string | null;
  const lastName = (meta.last_name ?? meta.family_name ?? null) as string | null;
  const computedFullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName =
    (meta.full_name as string | undefined) ??
    (computedFullName.length > 0 ? computedFullName : null);

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    full_name: fullName || null,
    first_name: firstName,
    last_name: lastName,
    avatar_url: (meta.avatar_url ?? meta.picture ?? null) as string | null,
    provider: (appMeta.provider ?? meta.provider ?? "guest") as string,
    is_guest: !!appMeta.is_anonymous,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("Failed to upsert profile:", error.message);
  }
}

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabaseEnabled));

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setUser(null);
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setUser(mapSupabaseUser(session?.user ?? null));
        setIsLoading(false);

        if (session?.user) {
          await upsertProfile(session.user);
        }
      } catch (error) {
        console.warn("Auth bootstrap failed:", error);

        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session: Session | null) => {
      try {
        setUser(mapSupabaseUser(session?.user ?? null));

        if (session?.user) {
          await upsertProfile(session.user);
        }
      } catch (error) {
        console.warn("Auth state change error:", error);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const continueAsGuest = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  };

  const signInWithApple = async () => {
    if (!supabase) {
      throw new Error("Supabase neprijungtas. Patikrink EXPO_PUBLIC_SUPABASE_URL ir EXPO_PUBLIC_SUPABASE_ANON_KEY.");
    }

    if (Platform.OS !== "ios") {
      throw new Error("Apple Sign In available only on iOS.");
    }

    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Apple Sign In is not available on this device.");
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple identity token not returned.");
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      access_token: credential.authorizationCode ?? undefined,
    });

    if (error) throw error;

    if (credential.fullName) {
      await supabase.auth.updateUser({
        data: {
          full_name:
            [credential.fullName.givenName, credential.fullName.familyName]
              .filter(Boolean)
              .join(" ") || null,
          first_name: credential.fullName.givenName ?? null,
          last_name: credential.fullName.familyName ?? null,
        },
      });
    }
  };

  const signInWithGoogle = async () => {
    throw new Error("Google Sign-In laikinai išjungtas šiame iOS beta build.");
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateUserProfile = async (updates: Partial<AuthUser>) => {
    if (!supabase) return;

    const payload = {
      full_name: updates.fullName,
      first_name: updates.firstName,
      last_name: updates.lastName,
      avatar_url: updates.avatar,
    };

    const { error: authError } = await supabase.auth.updateUser({ data: payload });
    if (authError) throw authError;

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (currentUser) {
      await upsertProfile(currentUser);
      setUser(mapSupabaseUser(currentUser));
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isGuest: !!user?.isGuest,
      isLoading,
      continueAsGuest,
      signInWithApple,
      signInWithGoogle,
      signOut,
      updateUserProfile,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
