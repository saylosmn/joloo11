// Spinning steering wheel loading indicator.
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { useReducedMotion } from "@/src/lib/motion";

type Props = { size?: number; color?: string };

export function LoadingWheel({ size = 64, color = "#2563EB" }: Props) {
  const reduced = useReducedMotion();
  const rot = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    rot.value = withRepeat(
      withTiming(360, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rot, reduced]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, spin]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="37" fill="none" stroke={color} strokeWidth="10" />
        <Circle cx="60" cy="60" r="12" fill={color} />
        <Path
          d="M23 60 H48 M72 60 H97 M60 72 V97"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

export default LoadingWheel;
