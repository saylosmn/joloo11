// Short sessions that sit between "practise a chapter" and "sit an exam":
// a five-minute blitz, a hundred-question marathon, a road-sign drill and a
// focus round on the user's weakest chapters.
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
import { ExamTimer } from "@/src/components/ExamTimer";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { ProgressRing } from "@/src/components/ProgressRing";
import { ProModal } from "@/src/components/ProModal";
import { ConfirmDialog } from "@/src/components/Sheet";
import { ListSkeleton } from "@/src/components/Skeleton";
import { QuestionSplit } from "@/src/components/QuestionSplit";
import { RuleReference } from "@/src/components/RuleReference";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { Card, ErrorState, PrimaryButton, ProgressBar } from "@/src/components/ui";
import { ApiError, api, imageUrl } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { enqueueAnswer } from "@/src/lib/offline-queue";
import { useResponsive } from "@/src/lib/responsive";
import { playAnswerSound } from "@/src/lib/sounds";
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
  seenCount?: number;
  wrongCount?: number;
};

export type QuickMode = "blitz" | "marathon" | "signs" | "weak";

const MODES: Record<
  QuickMode,
  {
    title: string;
    subtitle: string;
    icon: string;
    count: number;
    /** Seconds for the whole round, or 0 for untimed. */
    seconds: number;
    query: string;
  }
> = {
  blitz: {
    title: "5 минутын блиц",
    subtitle: "10 асуулт · 5 минут",
    icon: "flash",
    count: 10,
    seconds: 5 * 60,
    query: "/questions/random?count=10",
  },
  marathon: {
    title: "Марафон",
    subtitle: "100 асуулт · хугацаагүй",
    icon: "infinite",
    count: 100,
    seconds: 0,
    query: "/questions/random?count=100",
  },
  signs: {
    title: "Замын тэмдэг",
    subtitle: "Зөвхөн зурагтай асуулт",
    icon: "trail-sign",
    count: 20,
    seconds: 0,
    query: "/questions/random?count=20&imagesOnly=true",
  },
  weak: {
    title: "Сул талаа засах",
    subtitle: "Хамгийн бага зөвтэй бүлгүүдээс",
    icon: "trending-down",
    count: 15,
    seconds: 0,
    query: "/questions/random?count=15&weak=true",
  },
};

export default function QuickSession() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { mode, categoryId } = useLocalSearchParams<{ mode: string; categoryId?: string }>();

  const cfg = MODES[(mode as QuickMode) in MODES ? (mode as QuickMode) : "blitz"];
  const url = categoryId ? `${cfg.query}&category_id=${encodeURIComponent(categoryId)}` : cfg.query;

  const { data, isLoading, isError, refetch } = useQuery<Q[]>({
    queryKey: ["quick", mode, categoryId ?? null],
    queryFn: () => api.get(url),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  const questions = useMemo(() => data ?? [], [data]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const { contentWidthStyle } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);
  const startedAt = useRef(0);

  const answerMut = useMutation({
    mutationFn: (p: { question_id: string; selectedKey: string }) => api.post("/practice/answer", p),
  });

  // The clock starts when the questions land. For the blitz it also ends the
  // round by itself; untimed modes only use it to report how long it took.
  useEffect(() => {
    if (questions.length === 0 || finished) return;
    startedAt.current = Date.now();
    if (!cfg.seconds) return;
    const t = setInterval(() => {
      const e = Math.round((Date.now() - startedAt.current) / 1000);
      setElapsed(e);
      if (e >= cfg.seconds) {
        setDurationSec(cfg.seconds);
        setFinished(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [cfg.seconds, questions.length, finished]);

  const remaining = cfg.seconds ? Math.max(0, cfg.seconds - elapsed) : 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [idx]);

  if (isLoading) return <ListSkeleton topInset={insets.top} rows={3} header={false} rowHeight={120} />;
  if (isError && !data) return <ErrorState onRetry={refetch} />;
  if (questions.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
        <ErrorState message="Энэ горимд тохирох асуулт олдсонгүй." onRetry={refetch} />
        <View style={{ padding: spacing.gutter }}>
          <PrimaryButton title="Буцах" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const current = questions[Math.min(idx, questions.length - 1)];
  const selected = answers[current.question_id];
  const answered = selected != null;
  const correctCount = questions.filter((q) => answers[q.question_id] === q.correctKey).length;
  const answeredCount = Object.keys(answers).length;

  const optionState = (key: string): OptionState => {
    if (!answered) return "default";
    if (key === current.correctKey) return "correct";
    if (key === selected) return "wrong";
    return "default";
  };

  const pick = (key: string) => {
    if (answered) return;
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
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["limits"] });
          qc.invalidateQueries({ queryKey: ["categories"] });
        },
        onError: (e: any) => {
          const status = e instanceof ApiError ? e.status : -1;
          if (status === 0) {
            enqueueAnswer(current.question_id, key).catch(() => {});
            return;
          }
          if (status === 429) {
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

  /** Ends the round and freezes how long it took. */
  const finish = () => {
    setDurationSec(Math.round((Date.now() - (startedAt.current || Date.now())) / 1000));
    setFinished(true);
  };

  const goNext = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else finish();
  };

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    const seconds = durationSec;
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={[styles.doneWrap, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <ProgressRing size={160} stroke={12} percent={pct} color={pct >= 75 ? colors.success : colors.warning}>
          <Text style={[styles.donePct, { color: pct >= 75 ? colors.success : colors.warning }]}>{pct}%</Text>
          <Text style={styles.doneSub}>
            {correctCount}/{questions.length}
          </Text>
        </ProgressRing>
        <Text style={styles.doneTitle}>{cfg.title} дууслаа</Text>
        <Text style={styles.doneMeta}>
          {answeredCount}/{questions.length} хариулсан · {Math.floor(seconds / 60)} мин {seconds % 60} сек
        </Text>

        <Card style={{ alignSelf: "stretch", gap: spacing.sm }}>
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.doneRowText}>Зөв</Text>
            <Text style={styles.doneRowValue}>{correctCount}</Text>
          </View>
          <View style={styles.doneRow}>
            <Ionicons name="close-circle" size={18} color={colors.error} />
            <Text style={styles.doneRowText}>Буруу</Text>
            <Text style={styles.doneRowValue}>{answeredCount - correctCount}</Text>
          </View>
          <View style={styles.doneRow}>
            <Ionicons name="ellipse-outline" size={18} color={colors.muted} />
            <Text style={styles.doneRowText}>Хариулаагүй</Text>
            <Text style={styles.doneRowValue}>{questions.length - answeredCount}</Text>
          </View>
        </Card>

        <View style={{ alignSelf: "stretch", gap: spacing.md, marginTop: spacing.lg }}>
          <PrimaryButton
            title="Дахин эхлэх"
            icon="refresh"
            testID="quick-retry"
            onPress={() => {
              setAnswers({});
              setIdx(0);
              setElapsed(0);
              setDurationSec(0);
              setFinished(false);
              refetch();
            }}
          />
          <PrimaryButton title="Буцах" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="quick-quit"
          onPress={() => setQuitOpen(true)}
          hitSlop={10}
          style={styles.hBtn}
          accessibilityRole="button"
          accessibilityLabel="Гарах"
        >
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>

        {cfg.seconds ? (
          <ExamTimer remaining={remaining} total={cfg.seconds} size={52} testID="quick-timer" />
        ) : (
          <View style={styles.titleWrap}>
            <Ionicons name={cfg.icon as any} size={16} color={colors.brandPrimary} />
            <Text style={styles.hTitle} numberOfLines={1}>{cfg.title}</Text>
          </View>
        )}

        <Text style={styles.counter}>
          {idx + 1}/{questions.length}
        </Text>
      </View>

      <ProgressBar percent={((idx + 1) / questions.length) * 100} height={3} shimmer={false} />
      <OfflineBanner compact />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, contentWidthStyle]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={current.question_id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <QuestionSplit
            image={
              current.imageUrl ? (
                <QuestionImage uri={imageUrl(current.imageUrl)} style={{ marginBottom: spacing.lg }} />
              ) : null
            }
          >
          <Text style={styles.qNum}>№ {current.num}</Text>
          <Text style={styles.question} testID="quick-question">{current.questionText}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {current.options.map((o) => (
              <AnswerOption
                key={o.key}
                testID={`option-${o.key}`}
                optionKey={o.key}
                text={o.text}
                state={optionState(o.key)}
                disabled={answered}
                onPress={() => pick(o.key)}
              />
            ))}
          </View>
          </QuestionSplit>
          {answered && current.explanation ? (
            <Animated.View entering={FadeInDown.duration(260).springify().damping(18)} style={styles.explain}>
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

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="quick-next"
          title={idx < questions.length - 1 ? "Дараагийн" : "Дуусгах"}
          onPress={goNext}
          disabled={!answered}
        />
      </View>

      <ConfirmDialog
        visible={quitOpen}
        onClose={() => setQuitOpen(false)}
        title="Дуусгах уу?"
        message={`${answeredCount}/${questions.length} асуултад хариуллаа. Хариултууд хадгалагдсан.`}
        actions={[
          { label: "Үргэлжлүүлэх", onPress: () => setQuitOpen(false) },
          {
            label: "Дүнг харах",
            variant: "secondary",
            testID: "quick-finish",
            onPress: () => {
              setQuitOpen(false);
              finish();
            },
          },
        ]}
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
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "center" },
  hTitle: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  counter: { color: colors.muted, fontSize: type.base, fontFamily: font.bold, minWidth: 52, textAlign: "right" },
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
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  doneWrap: { paddingHorizontal: spacing.gutter, alignItems: "center", gap: spacing.md },
  donePct: { fontSize: type.display, fontFamily: font.extrabold },
  doneSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.bold },
  doneTitle: { color: colors.onSurface, fontSize: type.xl, fontFamily: font.bold, marginTop: spacing.md },
  doneMeta: { color: colors.muted, fontSize: type.base, fontFamily: font.regular, marginBottom: spacing.md },
  doneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  doneRowText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: type.base, fontFamily: font.medium },
  doneRowValue: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.extrabold },
}));
