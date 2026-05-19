export default ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_IOS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY;

  return {
    ...config,
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: "com.arbebus.app",
      merchantIdentifier: "merchant.com.arbebus.app",
      supportsTablet: true,
      usesAppleSignIn: true,
      buildNumber: "117",
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey,
      },
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["location", "fetch", "remote-notification"],

        NSCameraUsageDescription: "Arbebus naudoja kamerą QR kodų nuskaitymui.",

        NSLocationWhenInUseUsageDescription:
          "Arbebus naudoja tavo lokaciją maršrutams, artimiausiems autobusams ir tiksliems kelionės priminimams.",

        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Arbebus gali naudoti lokaciją fone, kad primintų kada išeiti ir perskaičiuotų kelionės priminimus.",

        NSUserNotificationsUsageDescription:
          "Arbebus siunčia kelionės priminimus ir įlipimo / išlipimo pranešimus.",
      },
    },
  };
};
