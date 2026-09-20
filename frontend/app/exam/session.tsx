import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { AnswerOption } from "@/src/components/AnswerOption";
import { AnsweredPill, ExamTimer } from "@/src/components/ExamTimer";
import { LoadingTrafficLight } from "@/src/components/illustrations";
import { ProModal } from "@/src/components/ProModal";
import { ConfirmDialog, Sheet } from "@/src/components/Sheet";
import { QuestionSplit } from "@/src/components/QuestionSplit";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { EmptyState, LoadingView, PrimaryButton } from "@/src/components/ui";
import { ApiError, api, imageUrl } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { setExamResult, type ExamResult } from "@/src/lib/examStore";
import { prefetchAhead } from "@/src/lib/prefetch";
import { useResponsive } from "@/src/lib/responsive";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

type Q = {
  question_id: string;
  num: number;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
};

type Session = {
  session_id: string;
  durationSeconds: number;
  remainingSeconds: number;
  category_name?: string | null;
  answers: Record<string, string>;
  questions: Q[];
  resumed?: boolean;
};

export default function ExamSession() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const { contentWidthStyle } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);

  // The server owns the question set and the clock. Starting again while a
  // session is live resumes it rather than spending another daily exam.
  const exam = useQuery<Session>({
    queryKey: ["exam-session", categoryId ?? null],
    queryFn: () =>
      api.get(categoryId ? `/exam/start?category_id=${encodeURIComponent(categoryId)}` : "/exam/start"),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const session = exam.data;
  const sessionId = session?.session_id;
  const questions = useMemo(() => session?.questions ?? [], [session]);
  // Saved answers come from the server; local picks sit on top of them.
  const answers = { ...(session?.answers ?? {}), ...picked };

  const submit = useMutation({
    mutationFn: (auto: boolean) =>
      api.post<ExamResult>("/exam/submit", {
        session_id: sessionId,
        // Flush local picks in case an autosave call was lost.
        answers: questions.map((q) => ({
          question_id: q.question_id,
          selectedKey: answers[q.question_id] ?? null,
        })),
        durationSeconds: auto ? session?.durationSeconds : (session?.durationSeconds ?? 0) - remaining,
      }),
    onSuccess: (res) => {
      setExamResult(res);
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["attempts"] });
      qc.invalidateQueries({ queryKey: ["limits"] });
      // Carry the id too, so the screen survives a reload.
      router.replace({ pathname: "/exam/result", params: { attemptId: res.attempt_id } });
    },
  });

  const saveAnswer = useMutation({
    mutationFn: (p: { question_id: string; selectedKey: string }) =>
      api.post("/exam/answer", { session_id: sessionId, ...p }),
  });

  const abandon = useMutation({
    mutationFn: () => api.post("/exam/abandon"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["exam-active"] });
      router.back();
    },
  });

  const remaining = Math.max(0, (session?.remainingSeconds ?? 0) - elapsed);

  // Tick from the moment the session lands, so a resumed exam shows the real
  // remaining time rather than a fresh 25 minutes.
  useEffect(() => {
    if (!sessionId) return;
    const from = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - from) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sessionId]);

  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!sessionId || remaining > 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    submit.mutate(true);
  }, [sessionId, remaining, submit]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [idx]);

  // Warm the images a few questions ahead; no waiting mid-exam.
  useEffect(() => {
    prefetchAhead(questions, idx);
  }, [questions, idx]);

  const pick = (question_id: string, selectedKey: string) => {
    setPicked((a) => ({ ...a, [question_id]: selectedKey }));
    saveAnswer.mutate({ question_id, selectedKey });
  };

  const loading = exam.isPending;
  const gated = exam.error instanceof ApiError && exam.error.status === 429;
  const errMsg =
    !gated && exam.error
      ? exam.error instanceof ApiError
        ? exam.error.message
        : "Шалгалт үүсгэхэд алдаа гарлаа"
      : submit.error
        ? "Илгээхэд алдаа гарлаа"
        : null;
  const categoryName = session?.category_name ?? null;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <LoadingTrafficLight size={80} />
        <Text style={{ color: colors.muted, fontFamily: "System", fontSize: 15 }}>Шалгалт бэлдэж байна...</Text>
      </View>
    );
  }

  if (gated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
        <EmptyState icon="time-outline" title="Өнөөдрийн эрх дууссан" subtitle="Free хэрэглэгч өдөрт 1 шалгалт өгнө. PRO болбол хязгааргүй." />
        <View style={{ padding: 20, gap: 10 }}>
          <PrimaryButton title="PRO болох" onPress={() => setProOpen(true)} testID="exam-pro-btn" />
          <PrimaryButton title="Буцах" variant="secondary" onPress={() => router.back()} />
        </View>
        <ProModal visible={proOpen} onClose={() => setProOpen(false)} profileName={user?.profileName} reason="Хязгааргүй шалгалт зөвхөн PRO." />
      </View>
    );
  }

  if (errMsg) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
        <EmptyState icon="alert-circle-outline" title="Алдаа" subtitle={errMsg} />
        <View style={{ padding: 20 }}>
          <PrimaryButton title="Буцах" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const current = questions[idx];
  const answeredCount = Object.keys(answers).length;
  const totalSeconds = session?.durationSeconds ?? 25 * 60;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="exam-quit"
          onPress={() => setQuitOpen(true)}
          hitSlop={10}
          style={styles.hBtn}
          accessibilityRole="button"
          accessibilityLabel="Шалгалтаас гарах"
        >
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>

        <ExamTimer remaining={remaining} total={totalSeconds} testID="exam-timer" />

        <View style={styles.headerRight}>
          <AnsweredPill answered={answeredCount} total={questions.length} />
          <Pressable
            testID="exam-open-grid"
            onPress={() => setGridOpen(true)}
            hitSlop={10}
            style={styles.hBtn}
            accessibilityRole="button"
            accessibilityLabel="Асуултын жагсаалт нээх"
          >
            <Ionicons name="grid-outline" size={20} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={[styles.progressFill, { width: `${((idx + 1) / questions.length) * 100}%` }]} />
      </View>

      {session?.resumed ? (
        <View style={styles.resumeBar} testID="exam-resumed">
          <Ionicons name="play-back-outline" size={13} color={colors.onBrandTertiary} />
          <Text style={styles.resumeText}>Хагас дутуу шалгалтыг үргэлжлүүллээ</Text>
        </View>
      ) : null}

      {categoryName ? (
        <View style={styles.catBar}>
          <Ionicons name="albums-outline" size={13} color={colors.brandPrimary} />
          <Text style={styles.catBarText} numberOfLines={1}>{categoryName}</Text>
        </View>
      ) : null}

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
                  uri={imageUrl(current.imageUrl)}
                  testID="exam-question-image"
                  style={{ marginBottom: spacing.lg }}
                />
              ) : null
            }
          >
          <Text style={styles.qNum}>Асуулт {idx + 1}</Text>
          <Text style={styles.question} testID="exam-question-text">{current.questionText}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {current.options.map((o) => (
              <AnswerOption
                key={o.key}
                testID={`option-${o.key}`}
                optionKey={o.key}
                text={o.text}
                state={answers[current.question_id] === o.key ? "selected" : "default"}
                onPress={() => pick(current.question_id, o.key)}
              />
            ))}
          </View>
          </QuestionSplit>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.navRow}>
          <Pressable
            testID="exam-prev"
            disabled={idx === 0}
            onPress={() => setIdx(idx - 1)}
            style={[styles.navBtn, { opacity: idx === 0 ? 0.4 : 1 }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.onSurfaceSecondary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            {idx < questions.length - 1 ? (
              <PrimaryButton testID="exam-next" title="Дараагийн" onPress={() => setIdx(idx + 1)} />
            ) : (
              <PrimaryButton testID="exam-submit" title={`Дуусгах (${answeredCount}/${questions.length})`} onPress={() => setConfirmOpen(true)} />
            )}
          </View>
        </View>
      </View>

      <ConfirmDialog
        visible={quitOpen}
        onClose={() => setQuitOpen(false)}
        testID="exam-quit-dialog"
        icon={<Ionicons name="exit-outline" size={34} color={colors.warning} />}
        title="Шалгалтаас гарах уу?"
        message="Гарсан ч энэ шалгалт өдрийн эрхээс тоологдсон хэвээр үлдэнэ. Хариултууд хадгалагдсан тул буцаж орвол үргэлжлүүлэх боломжтой."
        actions={[
          { label: "Үргэлжлүүлэх", onPress: () => setQuitOpen(false) },
          {
            label: "Дараа үргэлжлүүлнэ",
            variant: "secondary",
            testID: "quit-keep",
            onPress: () => {
              setQuitOpen(false);
              router.back();
            },
          },
          {
            label: "Шалгалтыг цуцлах",
            variant: "danger",
            testID: "quit-abandon",
            loading: abandon.isPending,
            onPress: () => abandon.mutate(),
          },
        ]}
      />

      <ConfirmDialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        testID="exam-submit-dialog"
        icon={
          <Ionicons
            name={answeredCount === questions.length ? "checkmark-done-circle" : "alert-circle"}
            size={34}
            color={answeredCount === questions.length ? colors.success : colors.warning}
          />
        }
        title="Шалгалтыг дуусгах уу?"
        message={
          answeredCount === questions.length
            ? `Бүх ${questions.length} асуултад хариулсан байна.`
            : `${answeredCount}/${questions.length} асуултад хариулсан. Үлдсэн ${questions.length - answeredCount} асуулт буруу тоологдоно.`
        }
        actions={[
          {
            label: "Тийм, дуусгах",
            testID: "confirm-submit",
            loading: submit.isPending,
            onPress: () => {
              setConfirmOpen(false);
              submit.mutate(false);
            },
          },
          { label: "Үргэлжлүүлэх", variant: "secondary", onPress: () => setConfirmOpen(false) },
        ]}
      />

      <Sheet
        visible={gridOpen}
        onClose={() => setGridOpen(false)}
        title="Асуулт руу шилжих"
        testID="exam-grid-sheet"
      >
        <View style={styles.gridLegend}>
          <LegendDot color={colors.brandPrimary} label="Одоо" />
          <LegendDot color={colors.success} label="Хариулсан" />
          <LegendDot color={colors.surfaceTertiary} label="Хоосон" />
        </View>
        <View style={styles.grid}>
          {questions.map((q, i) => {
            const done = answers[q.question_id] != null;
            const isCurrent = i === idx;
            return (
              <Pressable
                key={q.question_id}
                testID={`exam-grid-${i + 1}`}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}-р асуулт${done ? ", хариулсан" : ", хариулаагүй"}`}
                onPress={() => {
                  setIdx(i);
                  setGridOpen(false);
                }}
                style={[
                  styles.gridCell,
                  {
                    backgroundColor: done ? colors.successSubtle : colors.surfaceTertiary,
                    borderColor: isCurrent ? colors.brandPrimary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gridCellText,
                    { color: done ? colors.onSuccessSubtle : colors.onSurfaceTertiary },
                  ]}
                >
                  {i + 1}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  progressWrap: { height: 3, backgroundColor: colors.surfaceTertiary },
  progressFill: { height: 3, backgroundColor: colors.brandPrimary },
  resumeBar: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.gutter, paddingVertical: 7,
    backgroundColor: colors.brandTertiary,
  },
  resumeText: { color: colors.onBrandTertiary, fontSize: type.sm, fontFamily: font.semibold },
  catBar: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.gutter, paddingVertical: spacing.sm,
    backgroundColor: colors.brandTertiary,
  },
  catBarText: { color: colors.onBrandTertiary, fontSize: type.sm, fontFamily: font.semibold, flex: 1 },
  content: { padding: spacing.gutter, paddingBottom: spacing.xl },
  qNum: { color: colors.brandPrimary, fontSize: type.sm, fontFamily: font.bold, marginBottom: 6 },
  question: { color: colors.onSurface, fontSize: type.lg, lineHeight: 26, fontFamily: font.semibold, marginBottom: spacing.xl },
  options: { gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.gutter, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  navRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  navBtn: {
    width: 52, height: 52, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },
  gridLegend: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2, paddingBottom: spacing.md },
  gridCell: {
    width: 46, height: 46, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", borderWidth: 2,
  },
  gridCellText: { fontSize: type.md, fontFamily: font.bold },
}));
