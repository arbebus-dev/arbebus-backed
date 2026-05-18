const crypto = require("crypto");
const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const PAYSERA_BASE_URL = "https://www.paysera.com/pay/";
const PAYSERA_PROJECT_ID = process.env.PAYSERA_PROJECT_ID || "";
const PAYSERA_SIGN_PASSWORD = process.env.PAYSERA_SIGN_PASSWORD || "";

function toCents(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 100);
}

function requireStripe() {
  if (!stripe) {
    const error = new Error("STRIPE_SECRET_KEY is not configured");
    error.statusCode = 503;
    throw error;
  }
  return stripe;
}

function requirePaysera() {
  if (!PAYSERA_PROJECT_ID || !PAYSERA_SIGN_PASSWORD) {
    const error = new Error("PAYSERA_PROJECT_ID or PAYSERA_SIGN_PASSWORD is not configured");
    error.statusCode = 503;
    throw error;
  }
}

function publicBaseUrl(req) {
  return (
    process.env.ARBEBUS_PUBLIC_URL ||
    `${req.protocol}://${req.get("host")}`
  ).replace(/\/$/, "");
}

function backendBaseUrl(req) {
  return (
    process.env.ARBEBUS_BACKEND_URL ||
    `${req.protocol}://${req.get("host")}`
  ).replace(/\/$/, "");
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  let normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  return Buffer.from(normalized, "base64").toString("utf8");
}

function payseraSign(data) {
  return crypto.createHash("md5").update(data + PAYSERA_SIGN_PASSWORD).digest("hex");
}

function buildPayseraUrl(params) {
  const query = new URLSearchParams(params).toString();
  const data = base64UrlEncode(query);
  const sign = payseraSign(data);
  return `${PAYSERA_BASE_URL}?data=${encodeURIComponent(data)}&sign=${encodeURIComponent(sign)}`;
}

function verifyPayseraCallback(query) {
  const { data, sign } = query || {};
  if (!data || !sign) throw new Error("Missing Paysera callback data or sign");
  const expected = payseraSign(data);
  if (String(sign).toLowerCase() !== expected.toLowerCase()) {
    throw new Error("Invalid Paysera signature");
  }
  return Object.fromEntries(new URLSearchParams(base64UrlDecode(data)));
}

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    module: "payments",
    stripeConfigured: Boolean(STRIPE_SECRET_KEY),
    payseraConfigured: Boolean(PAYSERA_PROJECT_ID && PAYSERA_SIGN_PASSWORD),
  });
});

router.get("/methods", (_req, res) => {
  res.json({
    ok: true,
    methods: [
      { id: "stripe_card", title: "Visa / Mastercard", provider: "stripe" },
      { id: "apple_pay", title: "Apple Pay", provider: "stripe" },
      { id: "paysera_bank", title: "Bankai / Paysera", provider: "paysera" },
      { id: "revolut", title: "Revolut Pay", provider: "paysera" },
    ],
  });
});

router.post("/stripe/create-intent", async (req, res, next) => {
  try {
    const stripeClient = requireStripe();
    const { amount = 2.99, currency = "eur", metadata = {}, description = "Arbebus mokėjimas" } = req.body || {};
    const cents = toCents(amount);
    if (!cents) return res.status(400).json({ ok: false, message: "Invalid amount" });

    const intent = await stripeClient.paymentIntents.create({
      amount: cents,
      currency: String(currency).toLowerCase(),
      description,
      automatic_payment_methods: { enabled: true },
      metadata: { app: "arbebus", ...metadata },
    });

    res.json({ ok: true, clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (error) {
    next(error);
  }
});

router.post("/stripe/create-setup-intent", async (_req, res, next) => {
  try {
    const stripeClient = requireStripe();
    const setupIntent = await stripeClient.setupIntents.create({
      automatic_payment_methods: { enabled: true },
      metadata: { app: "arbebus", purpose: "save_payment_method" },
    });
    res.json({ ok: true, clientSecret: setupIntent.client_secret, setupIntentId: setupIntent.id });
  } catch (error) {
    next(error);
  }
});

router.post("/stripe/webhook", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const signature = req.headers["stripe-signature"];
    const rawBody = req.rawBody;
    if (!rawBody) throw new Error("Missing raw body for Stripe webhook");

    const event = STRIPE_WEBHOOK_SECRET
      ? stripeClient.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
      : req.body;

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      console.log("STRIPE_PAYMENT_SUCCEEDED", paymentIntent.id, paymentIntent.amount, paymentIntent.currency);
      // TODO production: įrašyti į DB payment statusą ir aktyvuoti bilietą / paslaugą.
    }

    if (event.type === "setup_intent.succeeded") {
      const setupIntent = event.data.object;
      console.log("STRIPE_SETUP_SUCCEEDED", setupIntent.id, setupIntent.payment_method);
      // TODO production: pririšti payment_method prie vartotojo profilio DB.
    }

    res.json({ received: true });
  } catch (error) {
    console.error("STRIPE_WEBHOOK_ERROR", error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

router.post("/paysera/create", (req, res, next) => {
  try {
    requirePaysera();
    const {
      amount = 2.99,
      currency = "EUR",
      orderId = `ARB-${Date.now()}`,
      email = "",
      description = "Arbebus mokėjimas",
      locale = "LIT",
    } = req.body || {};

    const cents = toCents(amount);
    if (!cents) return res.status(400).json({ ok: false, message: "Invalid amount" });

    const publicUrl = publicBaseUrl(req);
    const backendUrl = backendBaseUrl(req);

    const url = buildPayseraUrl({
      projectid: PAYSERA_PROJECT_ID,
      orderid: orderId,
      amount: cents,
      currency: String(currency).toUpperCase(),
      country: "LT",
      lang: locale,
      accepturl: process.env.PAYSERA_ACCEPT_URL || `${publicUrl}/payment-success`,
      cancelurl: process.env.PAYSERA_CANCEL_URL || `${publicUrl}/payment-cancel`,
      callbackurl: process.env.PAYSERA_CALLBACK_URL || `${backendUrl}/api/payments/paysera/callback`,
      test: process.env.PAYSERA_TEST === "1" || process.env.NODE_ENV !== "production" ? "1" : "0",
      p_email: email,
      paytext: description,
      version: "1.6",
    });

    res.json({ ok: true, orderId, url });
  } catch (error) {
    next(error);
  }
});

router.get("/paysera/callback", (req, res) => {
  try {
    const payload = verifyPayseraCallback(req.query);
    if (payload.status !== "1") {
      console.warn("PAYSERA_CALLBACK_NOT_PAID", payload.orderid, payload.status);
      return res.send("OK");
    }
    console.log("PAYSERA_PAYMENT_SUCCEEDED", payload.orderid, payload.amount, payload.currency);
    // TODO production: įrašyti į DB payment statusą ir aktyvuoti bilietą / paslaugą.
    res.send("OK");
  } catch (error) {
    console.error("PAYSERA_CALLBACK_ERROR", error.message);
    res.status(400).send("BAD");
  }
});

module.exports = router;
