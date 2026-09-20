// Animated "rolling road" loading indicator — replaces ActivityIndicator.
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { ClipPath, Path, Rect } from "react-native-svg";

import { useReducedMotion } from "@/src/lib/motion";

type Props = { size?: number };

export function LoadingRoad({ size = 80 }: Props) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(
      withTiming(30, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [y, reduced]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <ClipPath id="roadClip">
          <Path d="M44 16 L76 16 L98 104 L22 104 Z" />
        </ClipPath>
        <Path d="M44 16 L76 16 L98 104 L22 104 Z" fill="#2563EB" />
      </Svg>
      {/* Animated dashes rendered as Animated.View over the SVG */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
          },
          animStyle,
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <ClipPath id="roadClip2">
            <Path d="M44 16 L76 16 L98 104 L22 104 Z" />
          </ClipPath>
          <Rect clipPath="url(#roadClip2)" x="55" y="-12" width="10" height="16" rx="5" fill="#FFFFFF" />
          <Rect clipPath="url(#roadClip2)" x="55" y="18" width="10" height="16" rx="5" fill="#FFFFFF" />
          <Rect clipPath="url(#roadClip2)" x="55" y="48" width="10" height="16" rx="5" fill="#FFFFFF" />
          <Rect clipPath="url(#roadClip2)" x="55" y="78" width="10" height="16" rx="5" fill="#FFFFFF" />
          <Rect clipPath="url(#roadClip2)" x="55" y="108" width="10" height="16" rx="5" fill="#FFFFFF" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default LoadingRoad;
