import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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
import { ListSkeleton } from "@/src/components/Skeleton";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { EmptyState, ErrorState, PrimaryButton } from "@/src/components/ui";
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
  srsBox?: number;
  seenCount?: number;
  wrongCount?: number;
  note?: string;
  tags?: string[];
  category_name?: string;
  ruleRef?: string;
};

type ReviewData = {
  questions: Q[];
  /** Only the spaced-repetition queue reports these. */
  totalDue?: number;
  capped?: boolean;
};

export default function ReviewScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const isWrong = mode === "wrong";
  const isDue = mode === "due";
  const [proOpen, setProOpen] = useState(false);
  const { contentWidthStyle } = useResponsive();
  const [noteOpen, setNoteOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, { note: string; tags: string[] }>>({});

  const { data, isLoading, error, refetch } = useQuery<ReviewData>({
    queryKey: ["review", mode],
    queryFn: async () => {
      if (isDue) return api.get<ReviewData>("/review/due?limit=20");
      const list = await api.get<Q[]>(isWrong ? "/questions/wrong" : "/questions/bookmarked");
      return { questions: list };
    },
    retry: false,
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answerMut = useMutation({
    mutationFn: (p: { question_id: string; selectedKey: string }) => api.post("/practice/answer", p),
    onSuccess: () => {
      // The answer moves the question along the review ladder, so the due
      // counter on Home has to be refreshed too.
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const title = isDue
    ? "Өнөөдрийн давталт"
    : isWrong
      ? "Алдаатай асуултууд"
      : "Тэмдэглэсэн асуултууд";

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        testID="review-back"
        onPress={() => router.back()}
        hitSlop={10}
        style={styles.hBtn}
        accessibilityRole="button"
        accessibilityLabel="Буцах"
      >
        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.hTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.hBtn}>
        {(data?.questions?.length ?? 0) > 0 ? (
          <Pressable
            testID="review-note-open"
            onPress={() => setNoteOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Тэмдэглэл бичих"
          >
            <Ionicons name="create-outline" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  if (isLoading)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <ListSkeleton rows={3} header={false} rowHeight={120} />
      </View>
    );

  if (error && !data) {
    const gated = error instanceof ApiError && error.status === 403;
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        {gated ? (
          <View style={{ flex: 1 }}>
            <EmptyState icon="star-outline" title="Зөвхөн PRO" subtitle="Алдаатай асуултын горим PRO хэрэглэгчдэд нээлттэй." />
            <View style={{ padding: 20 }}>
              <PrimaryButton title="PRO болох" onPress={() => setProOpen(true)} testID="review-pro-btn" />
            </View>
            <ProModal visible={proOpen} onClose={() => setProOpen(false)} profileName={user?.profileName} reason="Алдаатай асуултын давталт зөвхөн PRO." />
          </View>
        ) : (
          <ErrorState onRetry={refetch} message={(error as any)?.message} />
        )}
      </View>
    );
  }

  const questions = data?.questions ?? [];
  if (questions.length === 0)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <EmptyState
          icon={isDue ? "checkmark-done-circle-outline" : isWrong ? "checkmark-done-circle-outline" : "bookmark-outline"}
          tone={isWrong || isDue ? "success" : "brand"}
          title={isDue ? "Өнөөдөр давтах зүйл алга" : isWrong ? "Алдаа алга" : "Тэмдэглэсэн асуулт алга"}
          subtitle={
            isDue
              ? "Бүх давталтаа хийчихлээ. Шинэ асуулт хийвэл дараагийн давталт төлөвлөгдөнө."
              : isWrong
                ? "Одоогоор буруу хариулсан асуулт байхгүй байна."
                : "Дасгал хийхдээ асуулт тэмдэглэж болно."
          }
          action={{
            label: "Бүлгээр давтах",
            icon: "albums",
            testID: "review-empty-action",
            onPress: () => router.push("/(tabs)/categories"),
          }}
        />
      </View>
    );

  const current = questions[Math.min(idx, questions.length - 1)];
  const selected = answers[current.question_id];
  const answered = selected != null;
  const saved = notes[current.question_id];
  const currentMeta = {
    note: saved?.note ?? current.note ?? "",
    tags: saved?.tags ?? current.tags ?? [],
  };

  const optionState = (key: string): OptionState => {
    if (!answered) return "default";
    if (key === current.correctKey) return "correct";
    if (key === selected) return "wrong";
    return "default";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {Header}
      <OfflineBanner compact />
      <View style={styles.counterRow}>
        <Text style={styles.counter}>
          {idx + 1} / {questions.length}
          {isDue && data?.totalDue ? `  ·  нийт ${data.totalDue} давталт` : ""}
        </Text>
      </View>
      {isDue && data?.capped ? (
        <Pressable style={styles.cappedRow} onPress={() => setProOpen(true)} testID="due-capped">
          <Ionicons name="lock-closed" size={13} color={colors.onWarningSubtle} />
          <Text style={styles.cappedText}>
            Үнэгүй хувилбарт өдөрт {questions.length} давталт. PRO болбол бүгд нээгдэнэ.
          </Text>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={[styles.content, contentWidthStyle]} showsVerticalScrollIndicator={false}>
        <Animated.View key={current.question_id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
        <QuestionSplit
          image={
            current.imageUrl ? (
              <QuestionImage uri={imageUrl(current.imageUrl)} style={{ marginBottom: spacing.lg }} />
            ) : null
          }
        >
        <Text style={styles.qNum}>№ {current.num}</Text>
        <Text style={styles.question}>{current.questionText}</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {current.options.map((o) => (
            <AnswerOption
              key={o.key}
              testID={`option-${o.key}`}
              optionKey={o.key}
              text={o.text}
              state={optionState(o.key)}
              disabled={answered}
              onPress={() => {
                playAnswerSound(o.key === current.correctKey);
                setAnswers((a) => ({ ...a, [current.question_id]: o.key }));
                answerMut.mutate(
                  { question_id: current.question_id, selectedKey: o.key },
                  {
                    onError: (e: any) => {
                      // Offline: keep the answer and replay it later.
                      if (e instanceof ApiError && e.status === 0) {
                        enqueueAnswer(current.question_id, o.key).catch(() => {});
                      }
                    },
                  },
                );
              }}
            />
          ))}
        </View>
        </QuestionSplit>

        <QuestionHistory seenCount={current.seenCount} wrongCount={current.wrongCount} />
        <QuestionTags tags={currentMeta.tags} note={currentMeta.note} />

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
      <QuestionNoteSheet
        key={current.question_id}
        visible={noteOpen}
        onClose={() => setNoteOpen(false)}
        questionId={current.question_id}
        initial={currentMeta}
        onSaved={(m) => setNotes((n) => ({ ...n, [current.question_id]: m }))}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton
          testID="review-next"
          title={idx < questions.length - 1 ? "Дараагийн" : "Дуусгах"}
          onPress={() => (idx < questions.length - 1 ? setIdx(idx + 1) : router.back())}
          disabled={!answered}
        />
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
  hTitle: { flex: 1, textAlign: "center", color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
  counterRow: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md },
  cappedRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: spacing.gutter, marginTop: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.warningSubtle,
  },
  cappedText: { flex: 1, color: colors.onWarningSubtle, fontSize: type.sm, fontFamily: font.semibold },
  counter: { color: colors.muted, fontSize: type.sm, fontFamily: font.semibold },
  content: { padding: spacing.gutter, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  qNum: { color: colors.brandPrimary, fontSize: type.sm, fontFamily: font.bold, marginBottom: 6 },
  question: { color: colors.onSurface, fontSize: type.lg, lineHeight: 26, fontFamily: font.semibold, marginBottom: spacing.xl },
  options: { gap: spacing.md },
  explain: {
    marginTop: spacing.lg, backgroundColor: colors.brandTertiary, borderRadius: radius.md,
    padding: spacing.md + 2, borderWidth: 1, borderColor: colors.border,
  },
  explainHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  explainTitle: { color: colors.info, fontSize: type.sm, fontFamily: font.bold },
  explainText: { color: colors.onSurfaceSecondary, fontSize: type.md, lineHeight: 23, fontFamily: font.regular },
  footer: {
    paddingHorizontal: spacing.gutter, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
}));
