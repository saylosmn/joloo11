import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ReactNode, useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from "react-native";

import { EmptyList, ErrorTriangle, LoadingRoad, NoConnection } from "@/src/components/illustrations";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/src/components/AppText";
import { useReducedMotion } from "@/src/lib/motion";
import {
  duration as dur,
  font,
  makeStyles,
  radius,
  spacing,
  motion,
  type,
  useElevation,
  useTheme,
} from "@/src/theme";

export function Icon({
  name,
  size = 22,
  color,
}: {
  name: any;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.onSurface} />;
}

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Press feedback shared by every tappable card and button: a small spring-in on
 * press, spring-out on release.
 */
export function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  // Shared values are stable refs, so they stay out of the dependency lists.
  const onPressIn = useCallback(() => {
    if (reduced) return;
    scale.value = withTiming(to, motion.snappy);
  }, [scale, to, reduced]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, motion.snappy);
  }, [scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { style, onPressIn, onPressOut };
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  icon,
  testID,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: any;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const press = usePressScale(0.97);

  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "danger"
        ? colors.errorSubtle
        : colors.surfaceTertiary;
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "danger"
        ? colors.onErrorSubtle
        : colors.onSurfaceTertiary;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, press.style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

/**
 * Animated progress bar. The fill springs to its new length, with a soft sheen
 * along the top edge so it reads as a solid object rather than a flat block.
 *
 * The length is a scaleX transform, not an animated width: `onLayout` is not
 * dependable on react-native-web (it can report a stale width and never fire
 * again) and animated percentage/flex values are not applied there at all,
 * whereas transforms work on every platform.
 */
export function ProgressBar({
  percent,
  tone = "brand",
  height = 8,
  shimmer = true,
  animate = true,
  label,
}: {
  percent: number;
  tone?: "brand" | "success" | "warning" | "error";
  height?: number;
  shimmer?: boolean;
  animate?: boolean;
  label?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const p = Math.max(0, Math.min(100, Math.round(percent || 0)));

  const reduced = useReducedMotion();
  const w = useSharedValue(animate && !reduced ? 0 : p);

  useEffect(() => {
    // Timing, not spring: reanimated's web runtime settles springs early, which
    // left the bar short of its real value in the browser build.
    w.value =
      animate && !reduced
        ? withTiming(p, { duration: dur.slow, easing: Easing.out(Easing.cubic) })
        : p;
  }, [p, animate, reduced, w]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0, w.value) / 100 }],
  }));

  const grad =
    tone === "success"
      ? [colors.success, colors.success]
      : tone === "warning"
        ? [colors.warning, colors.warning]
        : tone === "error"
          ? [colors.error, colors.error]
          : [colors.brand, colors.brandPrimary];

  return (
    <View
      style={[styles.progressTrack, { height, borderRadius: height }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `Гүйцэтгэл ${p} хувь`}
      accessibilityValue={{ min: 0, max: 100, now: p }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: height,
            overflow: "hidden",
            transformOrigin: "left center",
          },
          fillStyle,
        ]}
      >
        <LinearGradient colors={grad as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        {shimmer ? (
          <LinearGradient
            colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: height / 2 }}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

export function Badge({
  label,
  tone = "brand",
  icon,
}: {
  label: string;
  tone?: "brand" | "success" | "muted" | "warning" | "error";
  icon?: any;
}) {
  const { colors } = useTheme();
  const map = {
    brand: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
    success: { bg: colors.successSubtle, fg: colors.onSuccessSubtle },
    muted: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    warning: { bg: colors.warningSubtle, fg: colors.onWarningSubtle },
    error: { bg: colors.errorSubtle, fg: colors.onErrorSubtle },
  } as const;
  const c = map[tone];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: c.bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontSize: type.sm, fontFamily: font.bold }} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </View>
  );
}

export function Card({
  children,
  style,
  level = 1,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  level?: 0 | 1 | 2 | 3;
  testID?: string;
}) {
  const elev = useElevation(level);
  return (
    <View testID={testID} style={[{ borderRadius: radius.xl, padding: spacing.lg }, elev, style]}>
      {children}
    </View>
  );
}

/** Small entrance animation used to stagger lists and cards into view. */
export function FadeInView({
  children,
  delay = 0,
  from = 12,
  style,
}: {
  children: ReactNode;
  delay?: number;
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      v.value = 1;
      return;
    }
    v.value = withDelay(delay, withTiming(1, { duration: dur.base, easing: Easing.out(Easing.cubic) }));
  }, [delay, reduced, v]);
  const s = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * from }],
  }));
  return <Animated.View style={[s, style]}>{children}</Animated.View>;
}

export function LoadingView({ label }: { label?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.center} testID="loading-view">
      <LoadingRoad size={72} />
      {label ? <Text style={styles.centerText}>{label}</Text> : null}
    </View>
  );
}

/**
 * Two-tone illustration for empty screens: a soft disc, a floating icon and a
 * couple of orbiting dots. Cheap to draw, and far friendlier than a grey glyph.
 */
export function EmptyIllustration({
  icon = "documents-outline",
  tone = "muted",
  size = 132,
}: {
  icon?: any;
  tone?: "muted" | "brand" | "success" | "warning";
  size?: number;
}) {
  const { colors } = useTheme();
  const palette = {
    muted: { back: colors.surfaceTertiary, front: colors.brandTertiary, fg: colors.muted },
    brand: { back: colors.brandTertiary, front: colors.brandSecondary, fg: colors.brandPrimary },
    success: { back: colors.successSubtle, front: colors.surfaceTertiary, fg: colors.success },
    warning: { back: colors.warningSubtle, front: colors.surfaceTertiary, fg: colors.warning },
  }[tone];

  const reduced = useReducedMotion();
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [float, reduced]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * float.value }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.5 * float.value }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size * 0.78,
          height: size * 0.78,
          borderRadius: size,
          backgroundColor: palette.back,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: size,
          backgroundColor: palette.front,
          bottom: size * 0.08,
          right: size * 0.06,
          opacity: 0.8,
        }}
      />
      <Animated.View style={dotStyle}>
        <View
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            borderRadius: 10,
            backgroundColor: palette.fg,
            top: -size * 0.3,
            left: size * 0.26,
            opacity: 0.6,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 6,
            height: 6,
            borderRadius: 6,
            backgroundColor: palette.fg,
            top: size * 0.24,
            left: -size * 0.3,
            opacity: 0.5,
          }}
        />
      </Animated.View>
      <Animated.View style={floatStyle}>
        <Ionicons name={icon} size={Math.round(size * 0.34)} color={palette.fg} />
      </Animated.View>
    </View>
  );
}

export function EmptyState({
  icon = "documents-outline",
  title,
  subtitle,
  tone = "muted",
  action,
}: {
  icon?: any;
  title: string;
  subtitle?: string;
  tone?: "muted" | "brand" | "success" | "warning";
  action?: { label: string; onPress: () => void; icon?: any; testID?: string };
}) {
  const styles = useStyles();
  return (
    <View style={styles.center} testID="empty-state">
      <EmptyIllustration icon={icon} tone={tone} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.centerText}>{subtitle}</Text> : null}
      {action ? (
        <View style={{ marginTop: spacing.md, alignSelf: "stretch", paddingHorizontal: spacing.xl }}>
          <PrimaryButton title={action.label} icon={action.icon} onPress={action.onPress} testID={action.testID} />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.center} testID="error-state">
      <ErrorTriangle size={100} />
      <Text style={styles.emptyTitle}>Алдаа гарлаа</Text>
      <Text style={styles.centerText}>{message || "Дахин оролдоно уу."}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton title="Дахин оролдох" onPress={onRetry} variant="secondary" icon="refresh" />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontSize: type.lg, fontFamily: font.bold },
  progressTrack: {
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
    width: "100%",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.sm },
  centerText: {
    color: colors.muted,
    fontSize: type.base,
    textAlign: "center",
    fontFamily: font.regular,
    lineHeight: 20,
  },
  emptyTitle: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold, marginTop: spacing.sm },
}));
