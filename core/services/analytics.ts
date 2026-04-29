type AnalyticsProps = Record<string, unknown>;

let mixpanel: any = null;
let initialized = false;

async function getMixpanelSafe() {
  try {
    const mod = await import("mixpanel-react-native");
    const Mixpanel = mod.Mixpanel;

    if (!Mixpanel) return null;

    const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

    if (!token) {
      console.log("Analytics disabled: EXPO_PUBLIC_MIXPANEL_TOKEN missing");
      return null;
    }

    const instance = new Mixpanel(token, false);
    await instance.init();

    return instance;
  } catch (error: any) {
    console.log("Analytics disabled:", error?.message || error);
    return null;
  }
}

export async function initAnalytics() {
  if (initialized) return;
  initialized = true;
  mixpanel = await getMixpanelSafe();
}

export function track(eventName: string, props?: AnalyticsProps) {
  try {
    if (!mixpanel) return;
    mixpanel.track(eventName, props || {});
  } catch {
    // analytics niekada negali crashinti appso
  }
}

export function identify(userId: string) {
  try {
    if (!mixpanel) return;
    mixpanel.identify(userId);
  } catch {}
}

export function setUserProperties(props: AnalyticsProps) {
  try {
    if (!mixpanel) return;
    mixpanel.getPeople?.().set(props);
  } catch {}
}

export default {
  initAnalytics,
  track,
  identify,
  setUserProperties,
};