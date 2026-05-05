const appJson = require("./app.json");

module.exports = ({ config }) => {
  const expo = appJson.expo || config || {};
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ||
    process.env.GOOGLE_MAPS_IOS_API_KEY ||
    "";

  const ios = {
    ...(expo.ios || {}),
    config: {
      ...((expo.ios && expo.ios.config) || {}),
      ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
    },
  };

  return {
    ...expo,
    ios,
    extra: {
      ...(expo.extra || {}),
      googleMapsProviderEnabled: Boolean(googleMapsApiKey),
      API_BASE_URL:
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        process.env.EXPO_PUBLIC_API_BASE ||
        expo.extra?.API_BASE_URL,
    },
  };
};
