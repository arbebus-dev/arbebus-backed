import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { STORAGE_KEYS } from "../constants/home";

type UseHomeActionsParams = {
  destination: string;
  setHomeLocation: (value: string | null) => void;
  setWorkLocation: (value: string | null) => void;
  tapHaptic: () => Promise<void>;
};

export function useHomeActions({
  destination,
  setHomeLocation,
  setWorkLocation,
  tapHaptic,
}: UseHomeActionsParams) {
  const handleSaveHome = async () => {
    await tapHaptic();
    const value = destination.trim() || "Namai";

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.homeLocation, value);
      setHomeLocation(value);
      Alert.alert("✅ Namai išsaugoti", value);
    } catch (error) {
      console.log("Save home error:", error);
    }
  };

  const handleSaveWork = async () => {
    await tapHaptic();
    const value = destination.trim() || "Darbas";

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.workLocation, value);
      setWorkLocation(value);
      Alert.alert("✅ Darbas išsaugoti", value);
    } catch (error) {
      console.log("Save work error:", error);
    }
  };

  return {
    handleSaveHome,
    handleSaveWork,
  };
}