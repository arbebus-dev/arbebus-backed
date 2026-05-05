import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type TravelTimeMode = "now" | "depart" | "arrive";

export type TravelTimeSelection = {
  mode: TravelTimeMode;
  date: Date;
};

type Props = {
  visible: boolean;
  initialMode?: TravelTimeMode;
  initialDate?: Date | null;
  onClose: () => void;
  onConfirm: (selection: TravelTimeSelection) => void;
};

const WEEK_DAYS_LT = [
  "Sekmadienį",
  "Pirmadienį",
  "Antradienį",
  "Trečiadienį",
  "Ketvirtadienį",
  "Penktadienį",
  "Šeštadienį",
];

const MONTHS_LT = [
  "Sau",
  "Vas",
  "Kov",
  "Bal",
  "Geg",
  "Bir",
  "Lie",
  "Rgp",
  "Rgs",
  "Spa",
  "Lap",
  "Gru",
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function dateLabel(date: Date, today: Date) {
  if (sameDay(date, today)) return "Šiandien";
  if (sameDay(date, addDays(today, 1))) return "Rytoj";
  return `${WEEK_DAYS_LT[date.getDay()]} ${date.getDate()} ${MONTHS_LT[date.getMonth()]}`;
}

function clampMinute(minute: number) {
  return Math.round(minute / 5) * 5;
}

function makeDate(day: Date, hour: number, minute: number) {
  const next = new Date(day);
  next.setHours(hour, minute, 0, 0);
  return next;
}

/* ===========================
   ✅ FIXED WheelColumn
   =========================== */

function WheelColumn<T extends string | number>({
  values,
  selected,
  renderLabel,
  onSelect,
  width,
}: {
  values: T[];
  selected: T;
  renderLabel: (value: T) => string;
  onSelect: (value: T) => void;
  width?: number | string;
}) {
  const resolvedWidth: DimensionValue | undefined =
    typeof width === "string"
      ? (width as DimensionValue)
      : typeof width === "number"
        ? `${width * 100}%`
        : undefined;

  return (
    <ScrollView
      style={[
        styles.wheelColumn,
        resolvedWidth ? { width: resolvedWidth } : null,
      ]}
      contentContainerStyle={styles.wheelColumnContent}
      showsVerticalScrollIndicator={false}
      snapToInterval={54}
      decelerationRate="fast"
    >
      {values.map((value) => {
        const active = String(value) === String(selected);

        return (
          <Pressable
            key={String(value)}
            style={styles.wheelItem}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(value);
            }}
          >
            <Text
              style={[styles.wheelText, active && styles.wheelTextActive]}
              numberOfLines={1}
            >
              {renderLabel(value)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ===========================
   MAIN
   =========================== */

export default function TravelTimeModal({
  visible,
  initialMode = "now",
  initialDate,
  onClose,
  onConfirm,
}: Props) {
  const now = useMemo(() => new Date(), [visible]);
  const startDate = initialDate || now;

  const [mode, setMode] = useState<TravelTimeMode>(initialMode);
  const [dayIndex, setDayIndex] = useState(0);
  const [hour, setHour] = useState(startDate.getHours());
  const [minute, setMinute] = useState(clampMinute(startDate.getMinutes()));

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(now, i)),
    [now],
  );

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i * 5),
    [],
  );

  const selectedDate =
    mode === "now" ? now : makeDate(days[dayIndex] || now, hour, minute);

  const setNextMode = (next: TravelTimeMode) => {
    void Haptics.selectionAsync();
    setMode(next);
  };

  const confirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm({ mode, date: selectedDate });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <SafeAreaView>
          <View style={styles.card}>
            {/* HEADER */}
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.circleButton}>
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>

              <Text style={styles.title}>Kada vykti</Text>

              <Pressable
                onPress={confirm}
                style={[styles.circleButton, styles.confirm]}
              >
                <Ionicons name="checkmark" size={30} color="#000" />
              </Pressable>
            </View>

            {/* SEGMENTS */}
            <View style={styles.segmented}>
              {["now", "depart", "arrive"].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setNextMode(m as TravelTimeMode)}
                  style={[styles.segment, mode === m && styles.segmentActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      mode === m && styles.segmentTextActive,
                    ]}
                  >
                    {m === "now"
                      ? "Išvykti dabar"
                      : m === "depart"
                        ? "Išvykti"
                        : "Atvykti iki"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* PICKER */}
            <View style={styles.pickerWrap}>
              <View style={styles.selectionBand} />

              {mode === "now" ? (
                <View style={styles.nowPanel}>
                  <Text style={styles.nowTitle}>Dabar</Text>
                </View>
              ) : (
                <View style={styles.wheels}>
                  <WheelColumn
                    values={days.map((_, i) => i)}
                    selected={dayIndex}
                    onSelect={(v) => setDayIndex(Number(v))}
                    renderLabel={(v) => dateLabel(days[Number(v)], now)}
                    width="45%"
                  />

                  <WheelColumn
                    values={hours}
                    selected={hour}
                    onSelect={(v) => setHour(Number(v))}
                    renderLabel={(v) => String(v).padStart(2, "0")}
                    width="26%"
                  />

                  <WheelColumn
                    values={minutes}
                    selected={minute}
                    onSelect={(v) => setMinute(Number(v))}
                    renderLabel={(v) => String(v).padStart(2, "0")}
                    width="26%"
                  />
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/* ===========================
   STYLES
   =========================== */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#07111F",
    borderRadius: 24,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: {
    backgroundColor: "#37F5AE",
  },
  segmented: {
    flexDirection: "row",
    marginTop: 12,
    backgroundColor: "#111",
    borderRadius: 14,
    padding: 4,
  },
  segment: {
    flex: 1,
    padding: 10,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#37F5AE",
    borderRadius: 10,
  },
  segmentText: {
    color: "#aaa",
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#000",
  },
  pickerWrap: {
    height: 300,
    marginTop: 10,
  },
  wheels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  wheelColumn: {
    height: 300,
  },
  wheelColumnContent: {
    paddingVertical: 120,
  },
  wheelItem: {
    height: 50,
    justifyContent: "center",
  },
  wheelText: {
    color: "#888",
    textAlign: "center",
    fontSize: 18,
  },
  wheelTextActive: {
    color: "#fff",
    fontSize: 22,
  },
  selectionBand: {
    position: "absolute",
    top: 120,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(55,245,174,0.2)",
    borderRadius: 12,
  },
  nowPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  nowTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
  },
});
