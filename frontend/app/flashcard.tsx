import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { ProgressRing } from "@/src/components/ProgressRing";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { RuleReference } from "@/src/components/RuleReference";
import { ListSkeleton } from "@/src/components/Skeleton";
import { ErrorState, PrimaryButton } from "@/src/components/ui";
import { api, imageUrl } from "@/src/lib/api";
import { useResponsive } from "@/src/lib/responsive";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

type Q = {
  question_id: string;
  num: number;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation?: string;
  category_name?: string;
  ruleRef?: string;
};

const SWIPE_THRESHOLD = 80;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function FlashcardScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { contentWidthStyle } = useResponsive();

  const { data, isLoading, isError, refetch } = useQuery<Q[]>({
    queryKey: ["flashcard-signs"],
    queryFn: () => api.get("/questions/random?count=30&imagesOnly=true"),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  const questions = useMemo(() => data ?? [], [data]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const current = questions[idx];
  const knownCount = Object.values(known).filter(Boolean).length;
  const unknownCount = Object.values(known).filter((v) => v === false).length;

  // Flip animation
  const flipProgress = useSharedValue(0);

  const flip = useCallback(() => {
    setFlipped((f) => {
      const next = !f;
      flipProgress.value = withSpring(next ? 1 : 0, { damping: 15, stiffness: 120 });
      return next;
    });
  }, [flipProgress]);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [1, 1, 0, 0]),
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [0, 0, 1, 1]),
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  // Swipe animation
  const translateX = useSharedValue(0);

  const goTo = useCallback(
    (direction: "next" | "prev") => {
      if (direction === "next") {
        if (idx < questions.length - 1) {
          setIdx((i) => i + 1);
          setFlipped(false);
          flipProgress.value = 0;
        } else {
          setFinished(true);
        }
      } else {
        if (idx > 0) {
          setIdx((i) => i - 1);
          setFlipped(false);
          flipProgress.value = 0;
        }
      }
    },
    [idx, questions.length, flipProgress],
  );

  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200, easing: Easing.out(Easing.ease) }, () => {
          runOnJS(goTo)("next");
          translateX.value = 0;
        });
      } else if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200, easing: Easing.out(Easing.ease) }, () => {
          runOnJS(goTo)("prev");
          translateX.value = 0;
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [idx]);

  const markCard = (isKnown: boolean) => {
    if (!current) return;
    setKnown((k) => ({ ...k, [current.question_id]: isKnown }));
    goTo("next");
  };

  if (isLoading) return <ListSkeleton topInset={insets.top} rows={3} header={false} rowHeight={120} />;
  if (isError && !data) return <ErrorState onRetry={refetch} />;
  if (questions.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
        <ErrorState message="Зурагтай асуулт олдсонгүй." onRetry={refetch} />
      </View>
    );
  }

  if (finished) {
    const total = questions.length;
    const pct = total ? Math.round((knownCount / total) * 100) : 0;
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={[styles.doneWrap, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <ProgressRing size={160} stroke={12} percent={pct} color={pct >= 75 ? colors.success : colors.warning}>
          <Text style={[styles.donePct, { color: pct >= 75 ? colors.success : colors.warning }]}>{pct}%</Text>
          <Text style={styles.doneSub}>{knownCount}/{total}</Text>
        </ProgressRing>
        <Text style={styles.doneTitle}>Флашкарт дууслаа</Text>
        <Text style={styles.doneMeta}>
          {knownCount} мэдсэн · {unknownCount} мэдээгүй · {total - knownCount - unknownCount} алгассан
        </Text>

        <View style={{ alignSelf: "stretch", gap: spacing.md, marginTop: spacing.lg }}>
          <PrimaryButton
            title="Дахин эхлэх"
            icon="refresh"
            onPress={() => {
              setKnown({});
              setIdx(0);
              setFlipped(false);
              flipProgress.value = 0;
              setFinished(false);
              refetch();
            }}
          />
          <PrimaryButton title="Буцах" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  if (!current) return null;

  const correctOption = current.options.find((o) => o.key === current.correctKey);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.hBtn}
          accessibilityRole="button"
          accessibilityLabel="Буцах"
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Ionicons name="albums" size={16} color={colors.brandPrimary} />
          <Text style={styles.hTitle}>Флашкарт</Text>
        </View>
        <Text style={styles.counter}>{idx + 1}/{questions.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarWrap}>
        <View style={[styles.progressBarFill, { width: `${((idx + 1) / questions.length) * 100}%` }]} />
      </View>

      {/* Card area */}
      <View style={[styles.cardArea, contentWidthStyle]}>
        <GestureDetector gesture={swipeGesture}>
          <Animated.View style={[styles.cardContainer, cardSwipeStyle]}>
            <Pressable onPress={flip} style={styles.cardTouchable} accessibilityRole="button" accessibilityLabel="Картыг эргүүлэх">
              {/* Front side */}
              <Animated.View style={[styles.card, { backgroundColor: colors.elev1, borderColor: colors.border }, frontStyle]}>
                <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
                  {current.imageUrl ? (
                    <QuestionImage
                      uri={imageUrl(current.imageUrl)}
                      style={styles.cardImage}
                    />
                  ) : null}
                  <Text style={styles.cardNum}>№ {current.num}</Text>
                  <Text style={styles.cardQuestion}>{current.questionText}</Text>
                  <View style={styles.flipHint}>
                    <Ionicons name="sync-outline" size={16} color={colors.muted} />
                    <Text style={styles.flipHintText}>Товшоод хариуг харах</Text>
                  </View>
                </ScrollView>
              </Animated.View>

              {/* Back side */}
              <Animated.View style={[styles.card, styles.cardBack, { backgroundColor: colors.elev1, borderColor: colors.brandPrimary }, backStyle]}>
                <ScrollView ref={scrollRef} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.answerBadge}>
                    <View style={[styles.answerKeyCircle, { backgroundColor: colors.successSubtle }]}>
                      <Text style={[styles.answerKey, { color: colors.success }]}>{current.correctKey}</Text>
                    </View>
                    <Text style={styles.answerLabel}>Зөв хариулт</Text>
                  </View>
                  {correctOption ? (
                    <Text style={styles.answerText}>{correctOption.text}</Text>
                  ) : null}

                  {current.imageUrl ? (
                    <QuestionImage
                      uri={imageUrl(current.imageUrl)}
                      style={styles.answerImage}
                    />
                  ) : null}

                  {current.explanation ? (
                    <View style={[styles.explainBox, { backgroundColor: colors.brandTertiary, borderColor: colors.border }]}>
                      <View style={styles.explainHead}>
                        <Ionicons name="information-circle" size={18} color={colors.info} />
                        <Text style={[styles.explainTitle, { color: colors.info }]}>Тайлбар</Text>
                      </View>
                      <Text style={styles.explainText}>{current.explanation}</Text>
                    </View>
                  ) : null}

                  <RuleReference categoryName={current.category_name} ruleRef={current.ruleRef} />

                  <Text style={styles.cardQuestion2}>{current.questionText}</Text>

                  <View style={styles.allOptions}>
                    {current.options.map((o) => (
                      <View
                        key={o.key}
                        style={[
                          styles.optionRow,
                          {
                            backgroundColor: o.key === current.correctKey ? colors.successSubtle : colors.surfaceTertiary,
                            borderColor: o.key === current.correctKey ? colors.success : "transparent",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionKey,
                            { color: o.key === current.correctKey ? colors.success : colors.muted },
                          ]}
                        >
                          {o.key}
                        </Text>
                        <Text
                          style={[
                            styles.optionText,
                            { color: o.key === current.correctKey ? colors.onSuccessSubtle : colors.onSurfaceTertiary },
                          ]}
                        >
                          {o.text}
                        </Text>
                        {o.key === current.correctKey ? (
                          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                        ) : null}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Bottom actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerActions}>
          <Pressable
            onPress={() => markCard(false)}
            style={[styles.markBtn, { backgroundColor: colors.errorSubtle, borderColor: colors.error }]}
            accessibilityRole="button"
            accessibilityLabel="Мэдээгүй"
          >
            <Ionicons name="close" size={22} color={colors.error} />
            <Text style={[styles.markLabel, { color: colors.error }]}>Мэдээгүй</Text>
          </Pressable>

          <Pressable
            onPress={() => goTo("next")}
            style={[styles.skipBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Алгасах"
          >
            <Ionicons name="arrow-forward" size={20} color={colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => markCard(true)}
            style={[styles.markBtn, { backgroundColor: colors.successSubtle, borderColor: colors.success }]}
            accessibilityRole="button"
            accessibilityLabel="Мэдсэн"
          >
            <Ionicons name="checkmark" size={22} color={colors.success} />
            <Text style={[styles.markLabel, { color: colors.success }]}>Мэдсэн</Text>
          </Pressable>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scorePill}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={[styles.scoreText, { color: colors.success }]}>{knownCount}</Text>
          </View>
          <View style={styles.scorePill}>
            <Ionicons name="close-circle" size={14} color={colors.error} />
            <Text style={[styles.scoreText, { color: colors.error }]}>{unknownCount}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  hBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  hTitle: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  counter: { color: colors.muted, fontSize: type.base, fontFamily: font.bold, minWidth: 52, textAlign: "right" },
  progressBarWrap: { height: 3, backgroundColor: colors.surfaceTertiary },
  progressBarFill: { height: 3, backgroundColor: colors.brandPrimary },

  cardArea: { flex: 1, padding: spacing.gutter, justifyContent: "center" },
  cardContainer: { flex: 1 },
  cardTouchable: { flex: 1 },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xxl,
    borderWidth: 2,
    backfaceVisibility: "hidden",
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  cardBack: { borderWidth: 2 },
  cardContent: { padding: spacing.xl, alignItems: "center", flexGrow: 1, justifyContent: "center" },
  cardImage: { marginBottom: spacing.lg, maxHeight: 200 },
  cardNum: { color: colors.brandPrimary, fontSize: type.sm, fontFamily: font.bold, marginBottom: spacing.sm },
  cardQuestion: {
    color: colors.onSurface,
    fontSize: type.xl,
    lineHeight: 30,
    fontFamily: font.bold,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  flipHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  flipHintText: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },

  answerBadge: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  answerKeyCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  answerKey: { fontSize: type.xl, fontFamily: font.extrabold },
  answerLabel: { color: colors.muted, fontSize: type.base, fontFamily: font.semibold },
  answerText: {
    color: colors.onSurface,
    fontSize: type.lg,
    lineHeight: 26,
    fontFamily: font.bold,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  answerImage: { marginBottom: spacing.md, maxHeight: 140 },

  explainBox: {
    alignSelf: "stretch",
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  explainHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  explainTitle: { fontSize: type.sm, fontFamily: font.bold },
  explainText: { color: colors.onSurfaceSecondary, fontSize: type.md, lineHeight: 23, fontFamily: font.regular },

  cardQuestion2: {
    color: colors.muted,
    fontSize: type.sm,
    fontFamily: font.medium,
    textAlign: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  allOptions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.sm },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionKey: { fontSize: type.md, fontFamily: font.extrabold, width: 22 },
  optionText: { flex: 1, fontSize: type.base, fontFamily: font.medium },

  footer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    gap: spacing.md,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  markBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  markLabel: { fontSize: type.md, fontFamily: font.bold },
  skipBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    backgroundColor: colors.surfaceTertiary,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scoreText: { fontSize: type.sm, fontFamily: font.bold },

  doneWrap: { paddingHorizontal: spacing.gutter, alignItems: "center", gap: spacing.md },
  donePct: { fontSize: type.display, fontFamily: font.extrabold },
  doneSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.bold },
  doneTitle: { color: colors.onSurface, fontSize: type.xl, fontFamily: font.bold, marginTop: spacing.md },
  doneMeta: { color: colors.muted, fontSize: type.base, fontFamily: font.regular, marginBottom: spacing.md },
}));
