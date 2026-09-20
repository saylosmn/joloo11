// Countdown ring for the exam. The ring drains as the clock runs and the colour
// slides from brand blue to amber to red rather than snapping at a threshold,
// so time pressure builds instead of arriving as a jump scare. Under a minute
// the whole pill breathes.
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/src/components/AppText";
import { ProgressRing } from "@/src/components/ProgressRing";
import { useReducedMotion } from "@/src/lib/motion";
import { font, radius, type, useTheme } from "@/src/theme";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function rgbToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/**
 * Blend two colours through HSL, taking the short way round the hue circle.
 * Mixing blue and amber in RGB passes through grey — in HSL it stays a
 * saturated colour the whole way, which is what a countdown needs.
 */
function mix(a: string, b: string, t: number) {
  const k = Math.max(0, Math.min(1, t));
  const [h1, s1, l1] = rgbToHsl(a);
  const [h2, s2, l2] = rgbToHsl(b);
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (h1 + dh * k + 360) % 360;
  const s = s1 + (s2 - s1) * k;
  const l = l1 + (l2 - l1) * k;
  return `hsl(${h.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%)`;
}

export function ExamTimer({
  remaining,
  total,
  size = 58,
  testID,
}: {
  remaining: number;
  total: number;
  size?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining <= 60;

  // brand -> warning between 50% and 20% left, warning -> error below 20%.
  const color = useMemo(() => {
    if (ratio > 0.5) return colors.brand;
    if (ratio > 0.2) return mix(colors.brand, colors.warning, (0.5 - ratio) / 0.3);
    return mix(colors.warning, colors.error, (0.2 - ratio) / 0.2);
  }, [ratio, colors.brand, colors.warning, colors.error]);

  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!urgent || reduced) {
      pulse.value = withTiming(1, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [urgent, reduced, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View
      style={pulseStyle}
      testID={testID}
      accessible
      accessibilityLabel={`Үлдсэн хугацаа ${mins} минут ${secs} секунд`}
      accessibilityLiveRegion={urgent ? "polite" : "none"}
    >
      <ProgressRing
        size={size}
        stroke={4}
        percent={ratio * 100}
        color={color}
        trackColor={colors.surfaceTertiary}
        duration={900}
        animate={!reduced}
      >
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              color,
              fontSize: type.base,
              fontFamily: font.extrabold,
              fontVariant: ["tabular-nums"],
            }}
            maxFontSizeMultiplier={1.1}
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </Text>
        </View>
      </ProgressRing>
    </Animated.View>
  );
}

/** Compact answered-count pill used next to the timer. */
export function AnsweredPill({ answered, total }: { answered: number; total: number }) {
  const { colors } = useTheme();
  const done = answered >= total;
  return (
    <View
      accessible
      accessibilityLabel={`${answered} / ${total} асуултад хариулсан`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: done ? colors.successSubtle : colors.surfaceTertiary,
      }}
    >
      <Text
        style={{
          color: done ? colors.onSuccessSubtle : colors.onSurfaceTertiary,
          fontSize: type.sm,
          fontFamily: font.bold,
        }}
      >
        {answered}/{total}
      </Text>
    </View>
  );
}
