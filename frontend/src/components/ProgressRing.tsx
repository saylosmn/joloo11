// Circular progress without react-native-svg: two clipped half-rings whose
// rotation is driven by Reanimated. Adding a native dependency would force an
// EAS rebuild, and a ring is the one shape borders can draw on their own.
//
// Angles are measured clockwise from 12 o'clock. A circle's top+right borders
// cover exactly 180 degrees starting at -45, so rotating that half-ring by
// (deg - 135) puts its leading edge at `deg`; the clip hides the rest.
import { ReactNode, useEffect } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";

import { useReducedMotion } from "@/src/lib/motion";
import { duration as dur, useTheme } from "@/src/theme";

export function ProgressRing({
  size = 72,
  stroke = 6,
  percent,
  color,
  trackColor,
  children,
  style,
  animate = true,
  duration = dur.slow,
  delay = 0,
}: {
  size?: number;
  stroke?: number;
  percent: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  animate?: boolean;
  duration?: number;
  delay?: number;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const fg = color ?? colors.brandPrimary;
  const track = trackColor ?? colors.surfaceTertiary;
  const target = Math.max(0, Math.min(100, percent || 0));

  const p = useSharedValue(animate && !reduced ? 0 : target);

  useEffect(() => {
    if (!animate || reduced) {
      p.value = target;
      return;
    }
    const t = setTimeout(() => {
      p.value = withTiming(target, { duration, easing: Easing.out(Easing.cubic) });
    }, delay);
    return () => clearTimeout(t);
  }, [target, animate, reduced, duration, delay, p]);

  const half = {
    position: "absolute" as const,
    width: size / 2,
    height: size,
    overflow: "hidden" as const,
  };
  const arc = {
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: stroke,
    borderTopColor: fg,
    borderRightColor: fg,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  };

  const rightStyle = useAnimatedStyle(() => {
    const deg = Math.min(p.value * 3.6, 180);
    return { transform: [{ rotate: `${deg - 135}deg` }] };
  });
  const leftStyle = useAnimatedStyle(() => {
    const deg = Math.max(p.value * 3.6, 180);
    return { transform: [{ rotate: `${deg - 135}deg` }] };
  });

  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: track,
        }}
      />
      {/* right half (0–180deg) */}
      <View style={[half, { left: size / 2 }]}>
        <Animated.View style={[arc, { left: -size / 2 }, rightStyle]} />
      </View>
      {/* left half (180–360deg) */}
      <View style={[half, { left: 0 }]}>
        <Animated.View style={[arc, { left: 0 }, leftStyle]} />
      </View>
      {children ? (
        <View style={{ alignItems: "center", justifyContent: "center" }}>{children}</View>
      ) : null}
    </View>
  );
}
