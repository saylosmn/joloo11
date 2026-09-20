// Shimmering placeholders. Swapping the spinner for a skeleton that mirrors the
// real layout makes loading feel shorter even though it takes exactly as long.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { DimensionValue, StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "@/src/lib/motion";
import { radius, spacing, useTheme } from "@/src/theme";

const SHIMMER_WIDTH = 160;

export function Skeleton({
  width = "100%",
  height = 14,
  round = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const x = useSharedValue(-SHIMMER_WIDTH);

  useEffect(() => {
    if (reduced) return;
    x.value = withRepeat(
      withTiming(400, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [x, reduced]);

  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[
        { width, height, borderRadius: round, backgroundColor: colors.skeleton, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View style={[{ width: SHIMMER_WIDTH, height: "100%" }, shimmer]}>
        <LinearGradient
          colors={[colors.skeleton, colors.skeletonHighlight, colors.skeleton]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonCard({ lines = 2, height = 92 }: { lines?: number; height?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.elev1,
        padding: spacing.lg,
        gap: spacing.sm,
        justifyContent: "center",
      }}
    >
      <Skeleton width="55%" height={13} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "35%" : "85%"} height={10} />
      ))}
    </View>
  );
}

/** Home screen placeholder: hero block + goal card + action grid. */
export function HomeSkeleton({ topInset = 0 }: { topInset?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="home-skeleton">
      <View
        style={{
          paddingTop: topInset + 20,
          paddingHorizontal: spacing.gutter,
          paddingBottom: spacing.xl,
          backgroundColor: colors.skeleton,
          borderBottomLeftRadius: radius.xxl,
          borderBottomRightRadius: radius.xxl,
          gap: spacing.md,
        }}
      >
        <Skeleton width="40%" height={12} />
        <Skeleton width="60%" height={24} />
        <Skeleton width="100%" height={86} round={radius.lg} />
      </View>
      <View style={{ padding: spacing.gutter, gap: spacing.md }}>
        <SkeletonCard lines={2} />
        <Skeleton width="45%" height={18} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: "47%", flexGrow: 1 }}>
              <SkeletonCard lines={1} height={104} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Generic list placeholder used by Categories and Stats. */
export function ListSkeleton({
  topInset = 0,
  rows = 6,
  header = true,
  rowHeight = 92,
}: {
  topInset?: number;
  rows?: number;
  header?: boolean;
  rowHeight?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="list-skeleton">
      <View style={{ paddingTop: topInset + spacing.md, paddingHorizontal: spacing.gutter, gap: spacing.md }}>
        {header ? (
          <>
            <Skeleton width="42%" height={26} />
            <Skeleton width="65%" height={13} />
            <Skeleton width="100%" height={48} round={radius.md} />
          </>
        ) : null}
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonCard key={i} lines={1} height={rowHeight} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Stats placeholder: metric grid + chart blocks. */
export function StatsSkeleton({ topInset = 0 }: { topInset?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, padding: spacing.gutter, paddingTop: topInset + spacing.md, gap: spacing.md }}>
      <Skeleton width="40%" height={28} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: "47%", flexGrow: 1 }}>
            <SkeletonCard lines={1} height={96} />
          </View>
        ))}
      </View>
      <Skeleton width="50%" height={18} />
      <SkeletonCard lines={3} height={180} />
      <SkeletonCard lines={3} height={160} />
    </View>
  );
}
