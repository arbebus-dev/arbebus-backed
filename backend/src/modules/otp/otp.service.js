/* eslint-env node */
const client = require('./otp.client');
const { normalizeOtpPlan } = require('./otp.normalizer');

async function plan(input = {}) {
  if (!client.enabled()) return { ok: false, skipped: true, reason: 'OTP_DISABLED' };
  const otp = await client.plan(input);
  if (!otp.ok) return otp;
  return normalizeOtpPlan(otp);
}

module.exports = { plan, enabled: client.enabled };
