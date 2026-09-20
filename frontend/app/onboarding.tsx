// Three-slide intro shown once, right after the first sign-in. The last step
// asks for a daily goal so the Home goal card means something from day one.
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";

import {
  OnboardingCategories,
  OnboardingExam,
  OnboardingProgress,
} from "@/src/components/illustrations";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { PlacementStep } from "@/src/components/PlacementStep";
import { PrimaryButton } from "@/src/components/ui";
import { TOTAL_CATEGORIES, TOTAL_QUESTIONS } from "@/src/lib/content";
import { setOnboarded } from "@/src/lib/onboarding";
import { DEFAULT_DAILY_GOAL, setDailyGoal } from "@/src/lib/progress-local";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

const GOALS = [10, 20, 30, 50];

type Slide = {
  icon: string;
  illustration: ReactNode;
  title: string;
  body: string;
  tint: (c: any) => string;
};

const SLIDES: Slide[] = [
  {
    icon: "albums",
    illustration: <OnboardingCategories size={180} />,
    title: `${TOTAL_QUESTIONS} асуулт, ${TOTAL_CATEGORIES} бүлэг`,
    body: "Албан ёсны дүрмийн бүх асуулт бүлэг бүрээр эмхэлсэн. Зурагтай, тайлбартай.",
    tint: (c) => c.brandPrimary,
  },
  {
    icon: "school",
    illustration: <OnboardingExam size={180} />,
    title: "Жинхэнэ шалгалтын горим",
    body: "20 асуулт, 25 минут, 75% босго. Цаг нь дуусахад автоматаар дүгнэнэ — жинхэнэ шалгалттай яг ижил.",
    tint: (c) => c.success,
  },
  {
    icon: "stats-chart",
    illustration: <OnboardingProgress size={180} />,
    title: "Алдаагаа давт, ахицаа хар",
    body: "Буруу хариулсан асуулт тусдаа хадгалагдана. Өдөр тутмын streak, бүлгийн гүйцэтгэл шууд харагдана.",
    tint: (c) => c.warning,
  },
];

export default function Onboarding() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [goal, setGoal] = useState(DEFAULT_DAILY_GOAL);
  const x = useSharedValue(0);

  // slides + the placement check + the goal step
  const total = SLIDES.length + 2;
  const placementPage = SLIDES.length;
  const goalPage = SLIDES.length + 1;
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const goTo = (p: number) => {
    scrollRef.current?.scrollTo({ x: p * width, animated: true });
    setPage(p);
    Haptics.selectionAsync().catch(() => {});
  };

  const finish = async () => {
    await setDailyGoal(goal);
    await setOnboarded();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace("/(tabs)");
  };

  const skip = async () => {
    await setOnboarded();
    router.replace("/(tabs)");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <SlideView key={s.title} slide={s} index={i} width={width} x={x} topInset={insets.top} />
        ))}

        {/* placement check */}
        <View style={[styles.slide, { width, paddingTop: insets.top + spacing.lg }]}>
          <PlacementStep onDone={() => goTo(goalPage)} />
        </View>

        {/* goal step */}
        <View style={[styles.slide, { width, paddingTop: insets.top + spacing.xxl }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="flag" size={44} color={colors.brandPrimary} />
          </View>
          <Text style={styles.title}>Өдрийн зорилгоо сонго</Text>
          <Text style={styles.body}>
            Өдөрт хэдэн асуулт хийхээ шийд. Дараа нь нүүр хуудаснаас хэдийд ч өөрчилж болно.
          </Text>
          <View style={styles.goalRow}>
            {GOALS.map((g) => {
              const active = goal === g;
              return (
                <Pressable
                  key={g}
                  testID={`onboarding-goal-${g}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Өдөрт ${g} асуулт`}
                  onPress={() => {
                    setGoal(g);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={[
                    styles.goalChip,
                    active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
                  ]}
                >
                  <Text style={[styles.goalValue, active && { color: colors.onBrandPrimary }]}>{g}</Text>
                  <Text style={[styles.goalUnit, active && { color: colors.onBrandPrimary }]}>асуулт</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <Dot key={i} index={i} x={x} width={width} />
          ))}
        </View>

        {page === placementPage ? (
          // The placement step drives itself; a second button here would fight it.
          <View style={styles.placementSpacer} />
        ) : (
          <>
            <PrimaryButton
              title={page >= total - 1 ? "Эхлэх" : "Үргэлжлүүлэх"}
              icon={page >= total - 1 ? "rocket" : undefined}
              testID="onboarding-next"
              onPress={() => (page >= total - 1 ? finish() : goTo(page + 1))}
            />
            {page < total - 1 ? (
              <Pressable onPress={skip} style={styles.skip} accessibilityRole="button" testID="onboarding-skip">
                <Text style={styles.skipText}>Алгасах</Text>
              </Pressable>
            ) : (
              <View style={styles.skip} />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function SlideView({
  slide,
  index,
  width,
  x,
  topInset,
}: {
  slide: Slide;
  index: number;
  width: number;
  x: SharedValue<number>;
  topInset: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tint = slide.tint(colors);

  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(x.value, range, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(x.value, range, [0.88, 1, 0.88], Extrapolation.CLAMP) },
        { translateY: interpolate(x.value, range, [16, 0, 16], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={[styles.slide, { width, paddingTop: topInset + spacing.xxl }]}>
      <Animated.View style={[{ alignItems: "center" }, style]}>
        <View style={styles.iconWrap}>
          {slide.illustration}
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

function Dot({ index, x, width }: { index: number; x: SharedValue<number>; width: number }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(x.value, range, [8, 22, 8], Extrapolation.CLAMP),
      opacity: interpolate(x.value, range, [0.3, 1, 0.3], Extrapolation.CLAMP),
    };
  });
  return (
    <Animated.View
      style={[{ height: 8, borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, style]}
    />
  );
}

const useStyles = makeStyles((colors) => ({
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  iconWrap: {
    width: 128,
    height: 128,
    borderRadius: radius.xxl + 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.onSurface,
    fontSize: type.title,
    fontFamily: font.extrabold,
    textAlign: "center",
    marginTop: spacing.md,
  },
  body: {
    color: colors.muted,
    fontSize: type.md,
    lineHeight: 24,
    textAlign: "center",
    fontFamily: font.regular,
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  goalRow: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch", marginTop: spacing.lg },
  goalChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elev1,
    alignItems: "center",
  },
  goalValue: { color: colors.onSurface, fontSize: type.xxl, fontFamily: font.extrabold },
  goalUnit: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  footer: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md, gap: spacing.md },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: spacing.sm },
  skip: { alignItems: "center", paddingVertical: spacing.sm, minHeight: 36 },
  placementSpacer: { height: 8 },
  skipText: { color: colors.muted, fontSize: type.base, fontFamily: font.semibold },
}));
