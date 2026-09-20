import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/src/components/AppText";
import { useReducedMotion } from "@/src/lib/motion";
import { font, makeStyles, motion, radius, spacing, type, useTheme } from "@/src/theme";

export type OptionState = "default" | "selected" | "correct" | "wrong";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnswerOption({
  optionKey,
  text,
  state,
  onPress,
  disabled,
  testID,
}: {
  optionKey: string;
  text: string;
  state: OptionState;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduced = useReducedMotion();

  const config = {
    default: {
      bg: colors.surfaceSecondary,
      border: colors.border,
      fg: colors.onSurfaceSecondary,
      chipBg: colors.surfaceTertiary,
      chipFg: colors.onSurfaceTertiary,
      icon: null as string | null,
      accent: colors.brandPrimary,
    },
    selected: {
      bg: colors.brandTertiary,
      border: colors.brandPrimary,
      fg: colors.onBrandTertiary,
      chipBg: colors.brandPrimary,
      chipFg: colors.onBrandPrimary,
      icon: null as string | null,
      accent: colors.brandPrimary,
    },
    correct: {
      bg: colors.successSubtle,
      border: colors.success,
      fg: colors.onSuccessSubtle,
      chipBg: colors.success,
      chipFg: "#FFFFFF",
      icon: "checkmark" as string | null,
      accent: colors.success,
    },
    wrong: {
      bg: colors.errorSubtle,
      border: colors.error,
      fg: colors.onErrorSubtle,
      chipBg: colors.error,
      chipFg: "#FFFFFF",
      icon: "close" as string | null,
      accent: colors.error,
    },
  }[state];

  const resolved = state === "correct" || state === "wrong";

  // Feedback motion: correct answers bounce, wrong answers shake. Both leave a
  // short glow behind so the eye lands on the row that just changed.
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const glow = useSharedValue(0);
  const reveal = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    reveal.value = withTiming(resolved ? 1 : 0, { duration: reduced ? 0 : 180 });
    // With reduced motion the row still turns green or red and the tick still
    // appears; only the bounce, shake and glow are dropped.
    if (reduced) return;
    if (state === "correct") {
      scale.value = withSequence(
        withTiming(1.03, { duration: 130 }),
        withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2.5)) }),
      );
      glow.value = withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 620 }));
    } else if (state === "wrong") {
      shake.value = withSequence(
        withTiming(-4, { duration: 48 }),
        withTiming(4, { duration: 58 }),
        withTiming(-3, { duration: 52 }),
        withTiming(3, { duration: 48 }),
        withTiming(0, { duration: 44 }),
      );
      glow.value = withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 620 }));
    }
  }, [state, resolved, reduced, scale, shake, glow, reveal]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * press.value }, { translateX: shake.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.9,
    transform: [{ scale: 1 + glow.value * 0.02 }],
  }));
  const letterStyle = useAnimatedStyle(() => ({
    opacity: 1 - reveal.value,
    transform: [{ scale: 1 - reveal.value * 0.4 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: 0.6 + reveal.value * 0.4 }],
  }));

  return (
    <View>
      {/* glow ring — sits just outside the row and fades out */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { borderColor: config.accent, shadowColor: config.accent },
          glowStyle,
        ]}
      />
      <AnimatedPressable
        testID={testID}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityLabel={`${optionKey}. ${text}`}
        accessibilityState={{
          checked: state === "selected" || state === "correct",
          disabled: !!disabled,
        }}
        onPressIn={() => {
          if (!disabled && !reduced) press.value = withTiming(0.985, motion.snappy);
        }}
        onPressOut={() => {
          press.value = withTiming(1, motion.snappy);
        }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress?.();
        }}
        style={[
          styles.option,
          {
            backgroundColor: config.bg,
            borderColor: config.border,
            borderWidth: state === "default" ? 1 : 2,
          },
          rowStyle,
        ]}
      >
        <View style={[styles.chip, { backgroundColor: config.chipBg }]}>
          <Animated.Text
            style={[styles.chipText, { color: config.chipFg }, letterStyle]}
            maxFontSizeMultiplier={1.2}
          >
            {optionKey}
          </Animated.Text>
          {config.icon ? (
            <Animated.View style={[styles.chipIcon, iconStyle]}>
              <Ionicons name={config.icon as any} size={20} color={config.chipFg} />
            </Animated.View>
          ) : null}
        </View>
        <Text style={[styles.optionText, { color: config.fg }]} maxFontSizeMultiplier={1.4}>
          {text}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  option: {
    minHeight: 58,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  glow: {
    position: "absolute",
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: radius.lg + 3,
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: type.md, fontFamily: font.extrabold },
  chipIcon: { position: "absolute", alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1, fontSize: type.md, lineHeight: 22, fontFamily: font.medium },
}));
