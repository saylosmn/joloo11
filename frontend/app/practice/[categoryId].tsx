import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnswerOption, OptionState } from "@/src/components/AnswerOption";
import { ProModal } from "@/src/components/ProModal";
import { ErrorState, LoadingView, PrimaryButton } from "@/src/components/ui";
import { ApiError, api, imageUrl } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { prefetchAhead } from "@/src/lib/prefetch";
import { clearResume, getResume, setLastCategory, setResume } from "@/src/lib/progress-local";
import { font, makeStyles, useTheme } from "@/src/theme";

type Q = {
  question_id: string;
  num: number;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation?: string;
  isBookmarked?: boolean;
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
  const scrollRef = useRef<ScrollView>(null);
  const resumed = useRef(false);

  const answerMut = useMutation({
    mutationFn: (p: { question_id: string; selectedKey: string }) => api.post("/practice/answer", p),
    onError: (e: any) => {
      if (e instanceof ApiError && e.status === 429) setProOpen(true);
    },
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

  if (isLoading) return <LoadingView label="Асуултууд ачааллаж байна..." />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (!current) return <ErrorState message="Асуулт олдсонгүй" />;

  const selected = answers[current.question_id];
  const answered = selected != null;
  const quotaLeft = limits.data
    ? Math.max(0, limits.data.freeDailyQuestions - limits.data.questionsAnswered)
    : 0;

  const pick = (key: string) => {
    if (answered) return;
    answerMut.mutate(
      { question_id: current.question_id, selectedKey: key },
      {
        onSuccess: (res: any) => {
          setAnswers((a) => ({ ...a, [current.question_id]: key }));
          Haptics.notificationAsync(
            res?.isCorrect
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Error,
          ).catch(() => {});
          qc.invalidateQueries({ queryKey: ["categories"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["limits"] });
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
        <Pressable testID="practice-back" onPress={() => router.back()} hitSlop={10} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable onPress={() => setGridOpen(true)} style={styles.hCounter} testID="open-grid">
          <Text style={styles.hCounterText}>Асуулт {idx + 1}/{questions.length}</Text>
          <Ionicons name="grid-outline" size={16} color={colors.brandPrimary} />
        </Pressable>
        <Pressable
          testID="bookmark-toggle"
          onPress={() => bookmarkMut.mutate(current.question_id)}
          hitSlop={10}
          style={styles.hBtn}
        >
          <Ionicons name={initialBookmark ? "bookmark" : "bookmark-outline"} size={22} color={initialBookmark ? colors.brandPrimary : colors.muted} />
        </Pressable>
      </View>

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

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {current.imageUrl ? (
          <Image
            testID="question-image"
            source={{ uri: imageUrl(current.imageUrl) }}
            style={styles.image}
            contentFit="contain"
            transition={150}
          />
        ) : null}

        <Text style={styles.qNum}>№ {current.num}</Text>
        <Text style={styles.question} testID="question-text">{current.questionText}</Text>

        <View style={styles.options}>
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

        {answered && current.explanation ? (
          <View style={styles.explain} testID="explanation">
            <View style={styles.explainHead}>
              <Ionicons name="information-circle" size={18} color={colors.info} />
              <Text style={styles.explainTitle}>Тайлбар</Text>
            </View>
            <Text style={styles.explainText}>{current.explanation}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton
          testID="next-question"
          title={idx < questions.length - 1 ? "Дараагийн асуулт" : "Дуусгах"}
          onPress={goNext}
          disabled={!answered}
        />
      </View>

      {/* Grid modal */}
      <Modal visible={gridOpen} transparent animationType="slide" onRequestClose={() => setGridOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setGridOpen(false)} />
        <View style={[styles.gridSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.gridTitle}>Асуулт руу шилжих</Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {questions.map((q, i) => {
              const a = answers[q.question_id];
              const done = a != null;
              const correct = done && a === q.correctKey;
              return (
                <Pressable
                  key={q.question_id}
                  testID={`grid-${i + 1}`}
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
          </ScrollView>
        </View>
      </Modal>

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
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.surfaceSecondary,
  },
  hBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hCounter: { flexDirection: "row", alignItems: "center", gap: 6 },
  quotaRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingBottom: 8, paddingHorizontal: 20,
  },
  quotaText: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  hCounterText: { color: colors.onSurface, fontSize: 15, fontFamily: font.bold },
  progressBarWrap: { height: 3, backgroundColor: colors.surfaceTertiary },
  progressBarFill: { height: 3, backgroundColor: colors.brandPrimary },
  content: { padding: 20, paddingBottom: 24 },
  image: { width: "100%", height: 200, borderRadius: 14, backgroundColor: colors.surfaceTertiary, marginBottom: 16 },
  qNum: { color: colors.brandPrimary, fontSize: 13, fontFamily: font.bold, marginBottom: 6 },
  question: { color: colors.onSurface, fontSize: 17, lineHeight: 26, fontFamily: font.semibold, marginBottom: 20 },
  options: { gap: 12 },
  explain: {
    marginTop: 18,
    backgroundColor: colors.brandTertiary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  explainHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  explainTitle: { color: colors.info, fontSize: 13, fontFamily: font.bold },
  explainText: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 23, fontFamily: font.regular },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  gridSheet: {
    marginTop: "auto",
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "70%",
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 },
  gridTitle: { color: colors.onSurface, fontSize: 17, fontFamily: font.bold, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 12 },
  gridCell: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  gridCellText: { fontSize: 15, fontFamily: font.bold },
}));
