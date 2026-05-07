import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadows, spacing, typography } from "@/core/design";

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
  "Sekmadienis",
  "Pirmadienis",
  "Antradienis",
  "Trečiadienis",
  "Ketvirtadienis",
  "Penktadienis",
  "Šeštadienis",
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

const VISIBLE_ROWS = 5;
const CENTER_OFFSET = Math.floor(VISIBLE_ROWS / 2);

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

function clampMinute(minute: number) {
  return Math.round(minute / 5) * 5;
}

function makeDate(day: Date, hour: number, minute: number) {
  const next = new Date(day);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function dateLabel(date: Date, today: Date) {
  if (sameDay(date, today)) return "Šiandien";
  if (sameDay(date, addDays(today, 1))) return "Rytoj";
  return `${WEEK_DAYS_LT[date.getDay()]} ${date.getDate()} ${MONTHS_LT[date.getMonth()]}`;
}

function positiveModulo(value: number, total: number) {
  return ((value % total) + total) % total;
}

function modeLabel(mode: TravelTimeMode) {
  if (mode === "now") return "Išvykti dabar";
  if (mode === "depart") return "Išvykti";
  return "Atvykti iki";
}

function WheelColumn<T extends string | number>({
  values,
  selected,
  renderLabel,
  onSelect,
  width,
  loop = false,
}: {
  values: T[];
  selected: T;
  renderLabel: (value: T) => string;
  onSelect: (value: T) => void;
  width?: DimensionValue;
  loop?: boolean;
}) {
  const selectedIndex = Math.max(
    0,
    values.findIndex((value) => String(value) === String(selected)),
  );

  const visibleValues = Array.from({ length: VISIBLE_ROWS }, (_, rowIndex) => {
    const rawIndex = selectedIndex + rowIndex - CENTER_OFFSET;

    if (loop) {
      return values[positiveModulo(rawIndex, values.length)];
    }

    if (rawIndex < 0 || rawIndex >= values.length) return null;
    return values[rawIndex];
  });

  return (
    <View style={[styles.wheelColumn, width ? { width } : null]}>
      {visibleValues.map((value, rowIndex) => {
        const isActive = rowIndex === CENTER_OFFSET;

        if (value === null) {
          return <View key={`empty-${rowIndex}`} style={styles.wheelItem} />;
        }

        return (
          <Pressable
            key={`${String(value)}-${rowIndex}`}
            style={styles.wheelItem}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(value);
            }}
          >
            <Text
              numberOfLines={1}
              style={[styles.wheelText, isActive && styles.wheelTextActive]}
            >
              {renderLabel(value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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

  useEffect(() => {
    if (!visible) return;
    const nextStartDate = initialDate || new Date();
    setMode(initialMode);
    setDayIndex(0);
    setHour(nextStartDate.getHours());
    setMinute(clampMinute(nextStartDate.getMinutes()));
  }, [initialDate, initialMode, visible]);

  const days = useMemo(
    () => Array.from({ length: 21 }, (_, i) => addDays(now, i)),
    [now],
  );

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i * 5),
    [],
  );

  const selectedDate =
    mode === "now" ? now : makeDate(days[dayIndex] || now, hour, minute);

  const selectedSummary = useMemo(() => {
    if (mode === "now") return "Dabar";

    const dayText = dateLabel(days[dayIndex] || now, now);
    return `${dayText}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }, [dayIndex, days, hour, minute, mode, now]);

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
          <BlurView intensity={44} tint="dark" style={styles.card}>
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.circleButton}>
                <Ionicons name="close" size={28} color={colors.text} />
              </Pressable>

              <View style={styles.headerTitleWrap}>
                <Text style={styles.title}>Kada vykti</Text>
                <Text style={styles.subtitle}>{selectedSummary}</Text>
              </View>

              <Pressable
                onPress={confirm}
                style={[styles.circleButton, styles.confirm]}
              >
                <Ionicons name="checkmark" size={30} color={colors.textInverse} />
              </Pressable>
            </View>

            <View style={styles.segmented}>
              {(["now", "depart", "arrive"] as TravelTimeMode[]).map(
                (nextMode) => (
                  <Pressable
                    key={nextMode}
                    onPress={() => setNextMode(nextMode)}
                    style={[
                      styles.segment,
                      mode === nextMode && styles.segmentActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        mode === nextMode && styles.segmentTextActive,
                      ]}
                    >
                      {modeLabel(nextMode)}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>

            <View style={styles.pickerWrap}>
              {mode === "now" ? (
                <View style={styles.nowPanel}>
                  <Ionicons name="navigate" size={30} color={colors.accent} />
                  <Text style={styles.nowTitle}>Išvykti dabar</Text>
                  <Text style={styles.nowText}>
                    Maršrutas bus skaičiuojamas pagal dabartinį laiką.
                  </Text>
                </View>
              ) : (
                <View style={styles.wheelFrame}>
                  <View style={styles.selectionBand} />
                  <View style={styles.wheels}>
                    <WheelColumn
                      values={days.map((_, i) => i)}
                      selected={dayIndex}
                      onSelect={(value) => setDayIndex(Number(value))}
                      renderLabel={(value) => dateLabel(days[Number(value)], now)}
                      width="50%"
                    />

                    <WheelColumn
                      values={hours}
                      selected={hour}
                      onSelect={(value) => setHour(Number(value))}
                      renderLabel={(value) => String(value).padStart(2, "0")}
                      width="24%"
                      loop
                    />

                    <WheelColumn
                      values={minutes}
                      selected={minute}
                      onSelect={(value) => setMinute(Number(value))}
                      renderLabel={(value) => String(value).padStart(2, "0")}
                      width="24%"
                      loop
                    />
                  </View>
                </View>
              )}
            </View>
          </BlurView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderAccent,
    ...shadows.floating,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.black,
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.weight.semibold,
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: {
    backgroundColor: colors.accent,
  },
  segmented: {
    flexDirection: "row",
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.xl,
    padding: 5,
  },
  segment: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.black,
  },
  segmentTextActive: {
    color: colors.textInverse,
  },
  pickerWrap: {
    height: 260,
    marginTop: spacing.md,
  },
  wheelFrame: {
    flex: 1,
    justifyContent: "center",
  },
  wheels: {
    height: 220,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wheelColumn: {
    height: 220,
    justifyContent: "center",
  },
  wheelItem: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  wheelText: {
    color: colors.dim,
    textAlign: "center",
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    fontWeight: typography.weight.semibold,
  },
  wheelTextActive: {
    color: colors.text,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.black,
  },
  selectionBand: {
    position: "absolute",
    top: 88,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: "rgba(55,245,174,0.18)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  nowPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  nowTitle: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    fontWeight: typography.weight.black,
  },
  nowText: {
    marginTop: spacing.xs,
    color: colors.muted,
    textAlign: "center",
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.md,
    fontWeight: typography.weight.semibold,
  },
});
