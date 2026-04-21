import * as Location from "expo-location";
import { useEffect, useState } from "react";

export function useHeading() {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      sub = await Location.watchHeadingAsync((data) => {
        if (typeof data.trueHeading === "number" && data.trueHeading >= 0) {
          setHeading(data.trueHeading);
        } else if (typeof data.magHeading === "number") {
          setHeading(data.magHeading);
        }
      });
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  return heading;
}