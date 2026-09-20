// Confetti for a passed exam. Pure Reanimated — a fixed set of pieces that fall
// once, then stop; nothing keeps running in the background afterwards.
import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "@/src/lib/motion";
import { useTheme } from "@/src/theme";

const COUNT = 26;

function Piece({
  index,
  width,
  height,
  color,
  active,
}: {
  index: number;
  width: number;
  height: number;
  color: string;
  active: boolean;
}) {
  const t = useSharedValue(0);
  // Deterministic pseudo-random placement — same look every run, no jitter.
  const seed = (index * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  const startX = rnd * width;
  const drift = (rnd - 0.5) * 120;
  const size = 6 + ((index * 7) % 7);
  const delay = (index % 8) * 90;
  const spin = 360 + ((index * 53) % 540);

  useEffect(() => {
    if (!active) return;
    t.value = withDelay(delay, withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }));
  }, [active, delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - Math.max(0, t.value - 0.75) * 4,
    transform: [
      { translateY: -20 + t.value * (height + 40) },
      { translateX: t.value * drift },
      { rotate: `${t.value * spin}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: startX,
          top: 0,
          width: size,
          height: size * 1.6,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ active, height }: { active: boolean; height?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const win = useWindowDimensions();
  const h = height ?? win.height * 0.6;
  const palette = [colors.brandPrimary, colors.success, colors.warning, colors.info, "#F472B6"];

  // Falling pieces are pure decoration — the first thing to drop.
  if (!active || reduced) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: h, overflow: "hidden" }}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <Piece key={i} index={i} width={win.width} height={h} color={palette[i % palette.length]} active={active} />
      ))}
    </View>
  );
}
