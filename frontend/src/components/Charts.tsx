// Lightweight charts drawn with plain Views + Reanimated. No SVG dependency,
// which keeps the native build untouched; at these data sizes (7 bars, 10
// points) the difference is invisible.
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { Text } from "@/src/components/AppText";
import { duration as dur, font, radius, spacing, type, useTheme } from "@/src/theme";

export type BarDatum = { label: string; value: number; highlight?: boolean };

/**
 * Vertical bars with an optional goal line. Bars grow from the baseline on
 * mount, staggered left to right.
 */
export function BarChart({
  data,
  height = 140,
  goal,
  goalLabel,
  unit = "",
}: {
  data: BarDatum[];
  height?: number;
  goal?: number;
  goalLabel?: string;
  unit?: string;
}) {
  const { colors } = useTheme();
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const plot = height - 26;

  return (
    <View accessible accessibilityLabel={`Баганан график, ${data.length} өдөр`}>
      <View style={{ height, justifyContent: "flex-end" }}>
        {goal ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 26 + (plot * goal) / max,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.borderStrong, opacity: 0.9 }} />
            {goalLabel ? (
              <Text style={{ color: colors.muted, fontSize: type.xs, fontFamily: font.semibold }}>
                {goalLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, height }}>
          {data.map((d, i) => (
            <Bar
              key={`${d.label}-${i}`}
              datum={d}
              max={max}
              plot={plot}
              index={i}
              unit={unit}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Bar({
  datum,
  max,
  plot,
  index,
  unit,
}: {
  datum: BarDatum;
  max: number;
  plot: number;
  index: number;
  unit: string;
}) {
  const { colors } = useTheme();
  const target = Math.max(datum.value > 0 ? 6 : 3, (plot * datum.value) / max);
  const h = useSharedValue(0);

  useEffect(() => {
    h.value = withDelay(index * 60, withTiming(target, { duration: dur.slow, easing: Easing.out(Easing.cubic) }));
  }, [target, index, h]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  const empty = datum.value === 0;

  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Text
        style={{
          color: datum.highlight ? colors.brandPrimary : colors.muted,
          fontSize: type.xs,
          fontFamily: datum.highlight ? font.bold : font.medium,
        }}
      >
        {datum.value > 0 ? `${datum.value}${unit}` : ""}
      </Text>
      <Animated.View
        style={[
          {
            width: "78%",
            borderRadius: radius.sm,
            backgroundColor: empty
              ? colors.surfaceTertiary
              : datum.highlight
                ? colors.brandPrimary
                : colors.brandSecondary,
          },
          style,
        ]}
      />
      <Text
        style={{
          color: datum.highlight ? colors.onSurface : colors.muted,
          fontSize: type.xs,
          fontFamily: datum.highlight ? font.bold : font.regular,
        }}
      >
        {datum.label}
      </Text>
    </View>
  );
}

/**
 * Trend line for the last exams, with the pass threshold drawn behind it.
 * Segments are rotated rectangles — enough for ten points.
 */
export function TrendLine({
  values,
  threshold = 75,
  height = 150,
}: {
  values: { percent: number; passed: boolean }[];
  threshold?: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const pad = 10;
  const plotH = height - 24;
  const n = values.length;
  const step = n > 1 ? (w - pad * 2) / (n - 1) : 0;
  const yOf = (p: number) => plotH - (plotH * Math.max(0, Math.min(100, p))) / 100;

  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: dur.slow, easing: Easing.out(Easing.cubic) });
  }, [fade, n, w]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height }}
      accessible
      accessibilityLabel={`Сүүлийн ${n} шалгалтын хандлага`}
    >
      {/* threshold */}
      <View style={{ position: "absolute", left: 0, right: 0, top: yOf(threshold), flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.success, opacity: 0.45 }} />
        <Text style={{ color: colors.success, fontSize: type.xs, fontFamily: font.bold }}>{threshold}%</Text>
      </View>

      {w > 0 && n > 0 ? (
        <Animated.View style={[{ flex: 1 }, fadeStyle]}>
          {values.slice(0, -1).map((v, i) => {
            const x1 = pad + step * i;
            const y1 = yOf(v.percent);
            const x2 = pad + step * (i + 1);
            const y2 = yOf(values[i + 1].percent);
            const len = Math.hypot(x2 - x1, y2 - y1);
            const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            return (
              <View
                key={`seg-${i}`}
                style={{
                  position: "absolute",
                  left: x1,
                  top: y1,
                  width: len,
                  height: 2.5,
                  borderRadius: 2,
                  backgroundColor: colors.brandPrimary,
                  opacity: 0.85,
                  transformOrigin: "left center",
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          })}
          {values.map((v, i) => {
            const cx = pad + step * i;
            const cy = yOf(v.percent);
            return (
              <View key={`pt-${i}`} style={{ position: "absolute", left: cx - 6, top: cy - 6 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 12,
                    borderWidth: 2.5,
                    borderColor: v.passed ? colors.success : colors.error,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                />
              </View>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Legend row used under the charts. */
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: it.color }} />
          <Text style={{ color: colors.muted, fontSize: type.sm, fontFamily: font.medium }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
