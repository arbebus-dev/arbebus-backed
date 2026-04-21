import { Ionicons } from "@expo/vector-icons";

export const getWeatherLabelLt = (symbolCode?: string | null) => {
  if (!symbolCode) return "Ora duomenys";
  if (symbolCode.includes("clearsky")) return "Giedra";
  if (symbolCode.includes("fair")) return "Mažai debesuota";
  if (symbolCode.includes("partlycloudy")) return "Debesuota";
  if (symbolCode.includes("cloudy")) return "Debesuota";
  if (symbolCode.includes("rainshowers")) return "Trumpas lietus";
  if (symbolCode.includes("rain")) return "Lietus";
  if (symbolCode.includes("heavyrain")) return "Stiprus lietus";
  if (symbolCode.includes("sleet")) return "Šlapdriba";
  if (symbolCode.includes("snow")) return "Sniegas";
  if (symbolCode.includes("fog")) return "Rūkas";
  if (symbolCode.includes("thunder")) return "Perkūnija";
  return "Orai dabar";
};

export const getWeatherIconName = (
  symbolCode?: string | null
): React.ComponentProps<typeof Ionicons>["name"] => {
  if (!symbolCode) return "partly-sunny-outline";
  if (symbolCode.includes("clearsky")) return "sunny-outline";
  if (symbolCode.includes("fair")) return "partly-sunny-outline";
  if (symbolCode.includes("partlycloudy")) return "partly-sunny-outline";
  if (symbolCode.includes("cloudy")) return "cloud-outline";
  if (symbolCode.includes("rainshowers")) return "rainy-outline";
  if (symbolCode.includes("rain")) return "rainy-outline";
  if (symbolCode.includes("heavyrain")) return "rainy-outline";
  if (symbolCode.includes("sleet")) return "rainy-outline";
  if (symbolCode.includes("snow")) return "snow-outline";
  if (symbolCode.includes("fog")) return "cloud-outline";
  if (symbolCode.includes("thunder")) return "thunderstorm-outline";
  return "partly-sunny-outline";
};