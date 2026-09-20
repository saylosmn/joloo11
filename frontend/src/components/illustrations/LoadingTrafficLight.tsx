// Traffic light countdown loading — lights cycle red → yellow → green.
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Rect } from "react-native-svg";

import { useReducedMotion } from "@/src/lib/motion";

const AnimCircle = Animated.createAnimatedComponent(Circle);

type Props = { size?: number };

export function LoadingTrafficLight({ size = 80 }: Props) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(
      withTiming(3, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [t, reduced]);

  const redProps = useAnimatedProps(() => ({
    opacity: t.value < 1 ? 1 : 0.15,
  }));
  const yellowProps = useAnimatedProps(() => ({
    opacity: t.value >= 1 && t.value < 2 ? 1 : 0.15,
  }));
  const greenProps = useAnimatedProps(() => ({
    opacity: t.value >= 2 ? 1 : 0.15,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect x="34" y="12" width="52" height="96" rx="18" fill="#1E293B" />
      <AnimCircle cx="60" cy="36" r="13" fill="#EF4444" animatedProps={redProps} />
      <AnimCircle cx="60" cy="60" r="13" fill="#F59E0B" animatedProps={yellowProps} />
      <AnimCircle cx="60" cy="82" r="13" fill="#10B981" animatedProps={greenProps} />
    </Svg>
  );
}

export default LoadingTrafficLight;
