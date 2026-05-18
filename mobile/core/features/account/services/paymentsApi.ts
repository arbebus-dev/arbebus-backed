import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  extra.EXPO_PUBLIC_API_BASE_URL ||
  extra.API_BASE_URL ||
  "https://arbebus-backed.onrender.com";

type Json = Record<string, unknown>;

async function postJson<T>(path: string, body: Json): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(String(json?.message || `Request failed: ${res.status}`));
  }
  return json as T;
}

export async function createStripePaymentIntent(params: {
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
}) {
  return postJson<{ ok: true; clientSecret: string; paymentIntentId: string }>(
    "/api/payments/stripe/create-intent",
    {
      amount: params.amount,
      currency: params.currency || "eur",
      description: params.description || "Arbebus mokėjimas",
      metadata: params.metadata || {},
    },
  );
}

export async function createStripeSetupIntent() {
  return postJson<{ ok: true; clientSecret: string; setupIntentId: string }>(
    "/api/payments/stripe/create-setup-intent",
    {},
  );
}

export async function createPayseraPayment(params: {
  amount: number;
  currency?: string;
  description?: string;
  email?: string;
}) {
  return postJson<{ ok: true; orderId: string; url: string }>(
    "/api/payments/paysera/create",
    {
      amount: params.amount,
      currency: params.currency || "EUR",
      description: params.description || "Arbebus mokėjimas",
      email: params.email || "",
    },
  );
}
