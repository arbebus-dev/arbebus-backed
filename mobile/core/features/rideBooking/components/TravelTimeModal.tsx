import { colors, radius, shadows, spacing, typography } from "@/core/design";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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

const ITEM_HEIGHT = 46;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PAD = ITEM_HEIGHT * 2;

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
  return Math.min(55, Math.max(0, Math.round(minute / 5) * 5));
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

function modeLabel(mode: TravelTimeMode) {
  if (mode === "now") return "Dabar";
  if (mode === "depart") return "Išvykti";
  return "Atvykti iki";
}

function modeSummaryLabel(mode: TravelTimeMode) {
  if (mode === "now") return "Išvykti dabar";
  if (mode === "depart") return "Išvykimo laikas";
  return "Atvykimo laikas";
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clampIndex(index: number, max: number) {
  return Math.max(0, Math.min(index, max));
}

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
  width?: DimensionValue;
}) {
  const scrollRef = useRef<ScrollView | null>(null);

  const selectedIndex = Math.max(
    0,
    values.findIndex((value) => String(value) === String(selected)),
  );

  useEffect(() => {
    if (!values.length) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    });
  }, [selectedIndex, values.length]);

  const selectIndex = (index: number, animated = true) => {
    const nextIndex = clampIndex(index, values.length - 1);
    const nextValue = values[nextIndex];
    if (nextValue == null) return;
    scrollRef.current?.scrollTo({ y: nextIndex * ITEM_HEIGHT, animated });
    void Haptics.selectionAsync();
    onSelect(nextValue);
  };

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    selectIndex(rawIndex, true);
  };

  return (
    <View style={[styles.wheelColumn, width ? { width } : null]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.wheelContent}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleMomentumEnd}
      >
        {values.map((value, index) => {
          const isActive = index === selectedIndex;

          return (
            <Pressable
              key={`${String(value)}-${index}`}
              style={styles.wheelItem}
              onPress={() => selectIndex(index)}
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
      </ScrollView>
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
  const now = new Date();
  const startDate = initialDate || now;

  const [mode, setMode] = useState<TravelTimeMode>(initialMode);
  const [dayIndex, setDayIndex] = useState(0);
  const [hour, setHour] = useState(startDate.getHours());
  const [minute, setMinute] = useState(clampMinute(startDate.getMinutes()));

  const today = useMemo(() => startOfDay(new Date()), [visible]);
  const days = useMemo(
    () => Array.from({ length: 31 }, (_, i) => addDays(today, i)),
    [today],
  );
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i * 5),
    [],
  );

  useEffect(() => {
    if (!visible) return;
    const nextStartDate = initialDate || new Date();
    const nextDay = startOfDay(nextStartDate);
    const nextDayIndex = Math.max(
      0,
      days.findIndex((day) => sameDay(day, nextDay)),
    );

    setMode(initialMode);
    setDayIndex(nextDayIndex);
    setHour(nextStartDate.getHours());
    setMinute(clampMinute(nextStartDate.getMinutes()));
  }, [days, initialDate, initialMode, visible]);

  const selectedDate =
    mode === "now" ? now : makeDate(days[dayIndex] || today, hour, minute);

  const selectedSummary = useMemo(() => {
    if (mode === "now") return "Maršrutas bus skaičiuojamas nuo dabartinio laiko";

    const dayText = dateLabel(days[dayIndex] || today, today);
    return `${dayText}, ${formatTime(hour, minute)}`;
  }, [dayIndex, days, hour, minute, mode, today]);

  const setNextMode = (next: TravelTimeMode) => {
    void Haptics.selectionAsync();
    setMode(next);
  };

  const confirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm({ mode, date: selectedDate });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <BlurView intensity={72} tint="dark" style={styles.card}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.circleButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>

              <View style={styles.headerTitleWrap}>
                <Text style={styles.title}>Kelionės laikas</Text>
                <Text style={styles.subtitle}>{modeSummaryLabel(mode)}</Text>
              </View>

              <Pressable onPress={confirm} style={styles.okButton}>
                <Text style={styles.okButtonText}>OK</Text>
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

            <View style={styles.summaryCard}>
              <Ionicons name="time-outline" size={18} color="#34F5B3" />
              <Text style={styles.summaryText} numberOfLines={2}>
                {selectedSummary}
              </Text>
            </View>

            {mode === "now" ? (
              <View style={styles.nowPanel}>
                <View style={styles.nowIcon}>
                  <Ionicons name="flash" size={26} color="#07120D" />
                </View>
                <Text style={styles.nowTitle}>Išvykti dabar</Text>
                <Text style={styles.nowText}>
                  Paspaudus OK, maršrutas bus rodomas pagal dabartinį laiką.
                </Text>
              </View>
            ) : (
              <View style={styles.pickerWrap}>
                <View style={styles.wheelFrame}>
                  <View style={styles.selectionBand} />
                  <View pointerEvents="none" style={styles.topFade} />
                  <View pointerEvents="none" style={styles.bottomFade} />

                  <View style={styles.wheels}>
                    <WheelColumn
                      values={days.map((_, i) => i)}
                      selected={dayIndex}
                      onSelect={(value) => setDayIndex(Number(value))}
                      renderLabel={(value) => dateLabel(days[Number(value)], today)}
                      width="52%"
                    />

                    <WheelColumn
                      values={hours}
                      selected={hour}
                      onSelect={(value) => setHour(Number(value))}
                      renderLabel={(value) => String(value).padStart(2, "0")}
                      width="23%"
                    />

                    <WheelColumn
                      values={minutes}
                      selected={minute}
                      onSelect={(value) => setMinute(Number(value))}
                      renderLabel={(value) => String(value).padStart(2, "0")}
                      width="23%"
                    />
                  </View>
                </View>
              </View>
            )}
          </BlurView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "flex-end",
  },
  safeArea: {
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "rgba(7,12,22,0.97)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: 560,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: spacing.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    ...shadows.floating,
  },
  handle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginBottom: 16,
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
    fontSize: 21,
    lineHeight: 26,
    fontWeight: typography.weight.black,
    letterSpacing: -0.35,
  },
  subtitle: {
    marginTop: 2,
    color: "rgba(248,251,255,0.58)",
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    fontWeight: typography.weight.semibold,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  okButton: {
    minWidth: 58,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34F5B3",
    paddingHorizontal: 16,
  },
  okButtonText: {
    color: "#07120D",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: typography.weight.black,
  },
  segmented: {
    flexDirection: "row",
    marginTop: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  segmentActive: {
    backgroundColor: "rgba(52,245,179,0.18)",
  },
  segmentText: {
    color: "rgba(248,251,255,0.58)",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: typography.weight.black,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  summaryCard: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(52,245,179,0.10)",
    borderWidth: 1,
    borderColor: "rgba(52,245,179,0.18)",
  },
  summaryText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: typography.weight.black,
  },
  pickerWrap: {
    height: 300,
    marginTop: 16,
  },
  wheelFrame: {
    height: WHEEL_HEIGHT,
    justifyContent: "center",
    marginTop: 20,
    overflow: "hidden",
  },
  wheels: {
    height: WHEEL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wheelColumn: {
    height: WHEEL_HEIGHT,
  },
  wheelContent: {
    paddingTop: WHEEL_PAD,
    paddingBottom: WHEEL_PAD,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  wheelText: {
    color: "rgba(248,251,255,0.36)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: typography.weight.semibold,
  },
  wheelTextActive: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: typography.weight.black,
  },
  selectionBand: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.4,
    backgroundColor: "rgba(7,12,22,0.60)",
    zIndex: 2,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.4,
    backgroundColor: "rgba(7,12,22,0.60)",
    zIndex: 2,
  },
  nowPanel: {
    flex: 1,
    minHeight: 270,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  nowIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34F5B3",
    marginBottom: 14,
  },
  nowTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: typography.weight.black,
  },
  nowText: {
    marginTop: spacing.xs,
    color: "rgba(248,251,255,0.60)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.weight.semibold,
  },
});
