type AnalyticsProps = Record<string, unknown>;

let initialized = false;

export async function initAnalytics() {
  initialized = true;
}

export function track(_eventName: string, _props?: AnalyticsProps) {
  if (!initialized) return;
}

export function identify(_userId: string) {
  if (!initialized) return;
}

export function setUserProperties(_props: AnalyticsProps) {
  if (!initialized) return;
}

export default {
  initAnalytics,
  track,
  identify,
  setUserProperties,
};
