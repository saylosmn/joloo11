import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { AnswerOption, OptionState } from "@/src/components/AnswerOption";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { ProModal } from "@/src/components/ProModal";
import { QuestionHistory, QuestionNoteSheet, QuestionTags } from "@/src/components/QuestionNoteSheet";
import { QuestionSplit } from "@/src/components/QuestionSplit";
import { RuleReference } from "@/src/components/RuleReference";
import { Sheet } from "@/src/components/Sheet";
import { ListSkeleton } from "@/src/components/Skeleton";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { ErrorState, PrimaryButton } from "@/src/components/ui";
import { ApiError, api, imageUrl } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { enqueueAnswer } from "@/src/lib/offline-queue";
import { prefetchAhead } from "@/src/lib/prefetch";
import { useResponsive } from "@/src/lib/responsive";
import { playAnswerSound } from "@/src/lib/sounds";
import { clearResume, getResume, setLastCategory, setResume } from "@/src/lib/progress-local";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

type Q = {
  question_id: string;
  num: number;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation?: string;
  isBookmarked?: boolean;
  category_name?: string;
  ruleRef?: string;
  note?: string;
  tags?: string[];
  seenCount?: number;
  wrongCount?: number;
};

export default function PracticeScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  // F1: free users need to see how much of the daily quota is left.
  const limits = useQuery<{ isPro: boolean; questionsAnswered: number; freeDailyQuestions: number }>({
    queryKey: ["limits"],
    queryFn: () => api.get("/me/limits"),
  });

  const { data, isLoading, isError, refetch } = useQuery<Q[]>({
    queryKey: ["practice", categoryId],
    queryFn: () => api.get(`/categories/${categoryId}/questions`),
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [gridOpen, setGridOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const { contentWidthStyle } = useResponsive();
  const [noteOpen, setNoteOpen] = useState(false);
  // Notes saved in this session, layered over what the server sent.
  const [notes, setNotes] = useState<Record<string, { note: string; tags: string[] }>>({});
  const scrollRef = useRef<ScrollView>(null);
  const resumed = useRef(false);

  const answerMut = useMutation({
    mutationFn: (p: { question_id: string; selectedKey: string }) => api.post("/practice/answer", p),
  });

  const questions = useMemo(() => data ?? [], [data]);
  const current = questions[idx];

  // Restore the last viewed question for this category (once, after load).
  useEffect(() => {
    if (resumed.current || !categoryId || questions.length === 0) return;
    resumed.current = true;
    setLastCategory(categoryId);
    getResume(categoryId).then((saved) => {
      if (saved > 0 && saved < questions.length) setIdx(saved);
    });
  }, [categoryId, questions.length]);

  // Persist position + scroll back to top whenever the question changes.
  useEffect(() => {
    if (categoryId && questions.length > 0) setResume(categoryId, idx);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [idx, categoryId, questions.length]);

  // Warm the images a few questions ahead so "Дараагийн" feels instant.
  useEffect(() => {
    prefetchAhead(questions, idx);
  }, [questions, idx]);

  const initialBookmark = useMemo(
    () => (current ? bookmarks[current.question_id] ?? current.isBookmarked ?? false : false),
    [current, bookmarks],
  );

  const bookmarkMut = useMutation({
    mutationFn: (qid: string) => api.post(`/questions/${qid}/bookmark`),
    onSuccess: (res: any, qid) => setBookmarks((b) => ({ ...b, [qid]: res.isBookmarked })),
  });

  if (isLoading) return <ListSkeleton topInset={insets.top} rows={3} header={false} rowHeight={120} />;
  // A failed refresh with a warm cache is not an error — show the cached copy.
  if (isError && !data) return <ErrorState onRetry={refetch} />;
  if (!current) return <ErrorState message="Асуулт олдсонгүй" />;

  const selected = answers[current.question_id];
  const answered = selected != null;
  const saved = notes[current.question_id];
  const currentMeta = {
    note: saved?.note ?? current.note ?? "",
    tags: saved?.tags ?? current.tags ?? [],
  };
  const quotaLeft = limits.data
    ? Math.max(0, limits.data.freeDailyQuestions - limits.data.questionsAnswered)
    : 0;

  const pick = (key: string) => {
    if (answered) return;
    // The correct key ships with the question, so grading happens on device and
    // the answer shows instantly — online or not. The server call only records
    // it; if it cannot go out, the answer is queued and replayed later.
    const correct = key === current.correctKey;
    setAnswers((a) => ({ ...a, [current.question_id]: key }));
    Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
    playAnswerSound(correct);

    answerMut.mutate(
      { question_id: current.question_id, selectedKey: key },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["categories"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["limits"] });
        },
        onError: (e: any) => {
          const status = e instanceof ApiError ? e.status : -1;
          if (status === 0) {
            enqueueAnswer(current.question_id, key).catch(() => {});
            return;
          }
          if (status === 429) {
            // Over the daily quota: take the answer back and offer PRO.
            setAnswers((a) => {
              const next = { ...a };
              delete next[current.question_id];
              return next;
            });
            setProOpen(true);
          }
        },
      },
    );
  };

  const optionState = (key: string): OptionState => {
    if (!answered) return "default";
    if (key === current.correctKey) return "correct";
    if (key === selected) return "wrong";
    return "default";
  };

  const goNext = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else {
      if (categoryId) clearResume(categoryId);
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="practice-back"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.hBtn}
          accessibilityRole="button"
          accessibilityLabel="Буцах"
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable
          onPress={() => setGridOpen(true)}
          style={styles.hCounter}
          testID="open-grid"
          accessibilityRole="button"
          accessibilityLabel={`Асуулт ${idx + 1} / ${questions.length}. Жагсаалт нээх`}
        >
          <Text style={styles.hCounterText}>Асуулт {idx + 1}/{questions.length}</Text>
          <Ionicons name="grid-outline" size={16} color={colors.brandPrimary} />
        </Pressable>
        <Pressable
          testID="note-open"
          onPress={() => setNoteOpen(true)}
          hitSlop={10}
          style={styles.hBtn}
          accessibilityRole="button"
          accessibilityLabel="Тэмдэглэл бичих"
        >
          <Ionicons
            name={currentMeta.note || currentMeta.tags.length ? "create" : "create-outline"}
            size={20}
            color={currentMeta.note || currentMeta.tags.length ? colors.brandPrimary : colors.muted}
          />
        </Pressable>
        <Pressable
          testID="bookmark-toggle"
          onPress={() => bookmarkMut.mutate(current.question_id)}
          hitSlop={10}
          style={styles.hBtn}
          accessibilityRole="button"
          accessibilityState={{ selected: !!initialBookmark }}
          accessibilityLabel={initialBookmark ? "Тэмдэглэснээс хасах" : "Асуултыг тэмдэглэх"}
        >
          <Ionicons name={initialBookmark ? "bookmark" : "bookmark-outline"} size={22} color={initialBookmark ? colors.brandPrimary : colors.muted} />
        </Pressable>
      </View>

      <OfflineBanner compact />

      {limits.data && !limits.data.isPro ? (
        <Pressable
          style={styles.quotaRow}
          onPress={() => setProOpen(true)}
          testID="daily-quota"
        >
          <Ionicons
            name={quotaLeft > 0 ? "flash-outline" : "lock-closed"}
            size={14}
            color={quotaLeft > 0 ? colors.muted : colors.warning}
          />
          <Text style={[styles.quotaText, quotaLeft === 0 && { color: colors.warning }]}>
            {quotaLeft > 0
              ? `Өнөөдөр ${quotaLeft} шинэ асуулт үлдсэн`
              : "Өдрийн хязгаар дүүрлээ — PRO болох"}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.progressBarWrap}>
        <View style={[styles.progressBarFill, { width: `${((idx + 1) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, contentWidthStyle]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={current.question_id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <QuestionSplit
            image={
              current.imageUrl ? (
                <QuestionImage
                  testID="question-image"
                  uri={imageUrl(current.imageUrl)}
                  style={{ marginBottom: spacing.lg }}
                />
              ) : null
            }
          >
          <Text style={styles.qNum}>№ {current.num}</Text>
          <Text style={styles.question} testID="question-text">{current.questionText}</Text>

        <View style={styles.options} accessibilityRole="radiogroup">
          {current.options.map((o) => (
            <AnswerOption
              key={o.key}
              testID={`option-${o.key}`}
              optionKey={o.key}
              text={o.text}
              state={optionState(o.key)}
              disabled={answered || answerMut.isPending}
              onPress={() => pick(o.key)}
            />
          ))}
        </View>

          </QuestionSplit>

        <QuestionHistory seenCount={current.seenCount} wrongCount={current.wrongCount} />
        <QuestionTags tags={currentMeta.tags} note={currentMeta.note} />

        {answered && current.explanation ? (
          <Animated.View entering={FadeInDown.duration(260).springify().damping(18)} style={styles.explain} testID="explanation">
            <View style={styles.explainHead}>
              <Ionicons name="information-circle" size={18} color={colors.info} />
              <Text style={styles.explainTitle}>Тайлбар</Text>
            </View>
            <Text style={styles.explainText}>{current.explanation}</Text>
            <RuleReference categoryName={current.category_name} ruleRef={current.ruleRef} />
          </Animated.View>
        ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton
          testID="next-question"
          title={idx < questions.length - 1 ? "Дараагийн асуулт" : "Дуусгах"}
          onPress={goNext}
          disabled={!answered}
        />
      </View>

      <Sheet
        visible={gridOpen}
        onClose={() => setGridOpen(false)}
        title="Асуулт руу шилжих"
        snapPoints={["70%"]}
        testID="practice-grid-sheet"
      >
        <View style={styles.gridLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Зөв</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
            <Text style={styles.legendText}>Буруу</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.brandPrimary }]} />
            <Text style={styles.legendText}>Одоо</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {questions.map((q, i) => {
            const a = answers[q.question_id];
            const done = a != null;
            const correct = done && a === q.correctKey;
            return (
              <Pressable
                key={q.question_id}
                testID={`grid-${i + 1}`}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}-р асуулт${done ? (correct ? ", зөв" : ", буруу") : ""}`}
                onPress={() => {
                  setIdx(i);
                  setGridOpen(false);
                }}
                style={[
                  styles.gridCell,
                  {
                    backgroundColor: done
                      ? correct
                        ? colors.successSubtle
                        : colors.errorSubtle
                      : i === idx
                        ? colors.brandTertiary
                        : colors.surfaceTertiary,
                    borderColor: i === idx ? colors.brandPrimary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gridCellText,
                    { color: done ? (correct ? colors.onSuccessSubtle : colors.onErrorSubtle) : colors.onSurfaceTertiary },
                  ]}
                >
                  {i + 1}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <QuestionNoteSheet
        key={current.question_id}
        visible={noteOpen}
        onClose={() => setNoteOpen(false)}
        questionId={current.question_id}
        initial={currentMeta}
        onSaved={(m) => setNotes((n) => ({ ...n, [current.question_id]: m }))}
      />

      <ProModal
        visible={proOpen}
        onClose={() => setProOpen(false)}
        profileName={user?.profileName}
        reason="Өдрийн үнэгүй асуултын хязгаарт хүрлээ. PRO болбол хязгааргүй."
      />
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
  hCounter: { flexDirection: "row", alignItems: "center", gap: 6 },
  quotaRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingBottom: spacing.sm, paddingHorizontal: spacing.gutter,
  },
  quotaText: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  hCounterText: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  progressBarWrap: { height: 3, backgroundColor: colors.surfaceTertiary },
  progressBarFill: { height: 3, backgroundColor: colors.brandPrimary },
  content: { padding: spacing.gutter, paddingBottom: spacing.xl },
  qNum: { color: colors.brandPrimary, fontSize: type.sm, fontFamily: font.bold, marginBottom: 6 },
  question: { color: colors.onSurface, fontSize: type.lg, lineHeight: 26, fontFamily: font.semibold, marginBottom: spacing.xl },
  options: { gap: spacing.md },
  explain: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  explainHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  explainTitle: { color: colors.info, fontSize: type.sm, fontFamily: font.bold },
  explainText: { color: colors.onSurfaceSecondary, fontSize: type.md, lineHeight: 23, fontFamily: font.regular },
  footer: {
    paddingHorizontal: spacing.gutter, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  gridLegend: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2, paddingBottom: spacing.md },
  gridCell: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  gridCellText: { fontSize: type.md, fontFamily: font.bold },
}));
