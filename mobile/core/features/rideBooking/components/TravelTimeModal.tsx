import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

const WEEK_DAYS_LT = ["Sekmadienį", "Pirmadienį", "Antradienį", "Trečiadienį", "Ketvirtadienį", "Penktadienį", "Šeštadienį"];
const MONTHS_LT = ["Sau", "Vas", "Kov", "Bal", "Geg", "Bir", "Lie", "Rgp", "Rgs", "Spa", "Lap", "Gru"];

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
  const step = 5;
  return Math.round(minute / step) * step;
}

function makeDate(day: Date, hour: number, minute: number) {
  const next = new Date(day);
  next.setHours(hour, minute, 0, 0);
  return next;
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
  width?: number | string;
}) {
  return (
    <ScrollView
      style={[styles.wheelColumn, width ? { width } : null]}
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
            style={[styles.wheelItem, active && styles.wheelItemActive]}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(value);
            }}
          >
            <Text style={[styles.wheelText, active && styles.wheelTextActive]} numberOfLines={1}>
              {renderLabel(value)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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

  const days = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(now, index)), [now]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, index) => index * 5), []);

  const selectedDate = mode === "now" ? now : makeDate(days[dayIndex] || now, hour, minute);

  const setNextMode = (next: TravelTimeMode) => {
    void Haptics.selectionAsync();
    setMode(next);
  };

  const confirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm({ mode, date: selectedDate });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Pressable style={styles.circleButton} onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.title}>Kada vykti</Text>
              <Pressable style={[styles.circleButton, styles.confirmButton]} onPress={confirm} hitSlop={10}>
                <Ionicons name="checkmark" size={31} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.segmented}>
              <Pressable style={[styles.segment, mode === "now" && styles.segmentActive]} onPress={() => setNextMode("now")}>
                <Text style={[styles.segmentText, mode === "now" && styles.segmentTextActive]}>Išvykti dabar</Text>
              </Pressable>
              <Pressable style={[styles.segment, mode === "depart" && styles.segmentActive]} onPress={() => setNextMode("depart")}>
                <Text style={[styles.segmentText, mode === "depart" && styles.segmentTextActive]}>Išvykti</Text>
              </Pressable>
              <Pressable style={[styles.segment, mode === "arrive" && styles.segmentActive]} onPress={() => setNextMode("arrive")}>
                <Text style={[styles.segmentText, mode === "arrive" && styles.segmentTextActive]}>Atvykti iki</Text>
              </Pressable>
            </View>

            <View style={styles.pickerWrap}>
              <View style={styles.selectionBand} pointerEvents="none" />
              {mode === "now" ? (
                <View style={styles.nowPanel}>
                  <Text style={styles.nowTitle}>Dabar</Text>
                  <Text style={styles.nowSubtitle}>Naudosime artimiausius realius autobusų laikus.</Text>
                </View>
              ) : (
                <View style={styles.wheels}>
                  <WheelColumn
                    values={days.map((_, index) => index)}
                    selected={dayIndex}
                    onSelect={(value) => setDayIndex(Number(value))}
                    renderLabel={(value) => dateLabel(days[Number(value)] || now, now)}
                    width="45%"
                  />
                  <WheelColumn
                    values={hours}
                    selected={hour}
                    onSelect={(value) => setHour(Number(value))}
                    renderLabel={(value) => String(value).padStart(2, "0")}
                    width="26%"
                  />
                  <WheelColumn
                    values={minutes}
                    selected={minute}
                    onSelect={(value) => setMinute(Number(value))}
                    renderLabel={(value) => String(value).padStart(2, "0")}
                    width="26%"
                  />
                </View>
              )}
            </View>

            <Text style={styles.footerText}>
              {mode === "now"
                ? "Maršrutai bus skaičiuojami nuo dabartinio laiko."
                : mode === "depart"
                  ? `Išvykimas: ${dateLabel(selectedDate, now)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
                  : `Atvykimas iki: ${dateLabel(selectedDate, now)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.46)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  safeArea: { width: "100%" },
  card: {
    minHeight: 570,
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#171A20",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", letterSpacing: -0.2 },
  circleButton: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  confirmButton: { backgroundColor: "#2F80FF" },
  segmented: { flexDirection: "row", padding: 4, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.13)", marginBottom: 18 },
  segment: { flex: 1, minHeight: 45, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  segmentText: { color: "rgba(255,255,255,0.70)", fontSize: 14, fontWeight: "900" },
  segmentTextActive: { color: "#FFFFFF" },
  pickerWrap: { height: 360, borderRadius: 24, overflow: "hidden", justifyContent: "center" },
  selectionBand: { position: "absolute", left: 10, right: 10, top: 151, height: 58, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.13)", zIndex: 1 },
  wheels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 2 },
  wheelColumn: { height: 350 },
  wheelColumnContent: { paddingVertical: 146 },
  wheelItem: { height: 54, justifyContent: "center", paddingHorizontal: 4 },
  wheelItemActive: {},
  wheelText: { color: "rgba(255,255,255,0.27)", fontSize: 24, fontWeight: "900", textAlign: "center" },
  wheelTextActive: { color: "#FFFFFF", fontSize: 29 },
  nowPanel: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22, zIndex: 2 },
  nowTitle: { color: "#FFFFFF", fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  nowSubtitle: { color: "rgba(255,255,255,0.56)", fontSize: 16, fontWeight: "800", lineHeight: 22, textAlign: "center", marginTop: 10 },
  footerText: { color: "rgba(255,255,255,0.56)", fontSize: 13, fontWeight: "800", lineHeight: 18, textAlign: "center", marginTop: 14 },
});
