import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnswerOption } from "@/src/components/AnswerOption";
import { ProModal } from "@/src/components/ProModal";
import { EmptyState, LoadingView, PrimaryButton } from "@/src/components/ui";
import { ApiError, api, imageUrl } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { setExamResult, type ExamResult } from "@/src/lib/examStore";
import { prefetchAhead } from "@/src/lib/prefetch";
import { font, makeStyles, useTheme } from "@/src/theme";

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
  const [proOpen, setProOpen] = useState(false);
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

  if (loading) return <LoadingView label="Шалгалт бэлдэж байна..." />;

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
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const low = remaining < 5 * 60;
  const answeredCount = Object.keys(answers).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="exam-quit" onPress={() => setQuitOpen(true)} hitSlop={10} style={styles.hBtn}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={[styles.timer, { backgroundColor: low ? colors.errorSubtle : colors.surfaceTertiary }]} testID="exam-timer">
          <Ionicons name="time-outline" size={16} color={low ? colors.error : colors.onSurfaceTertiary} />
          <Text style={[styles.timerText, { color: low ? colors.error : colors.onSurfaceTertiary }]}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </Text>
        </View>
        <Text style={styles.counter}>{idx + 1}/{questions.length}</Text>
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

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {current.imageUrl ? (
          <Image source={{ uri: imageUrl(current.imageUrl) }} style={styles.image} contentFit="contain" transition={150} />
        ) : null}
        <Text style={styles.qNum}>Асуулт {idx + 1}</Text>
        <Text style={styles.question} testID="exam-question-text">{current.questionText}</Text>
        <View style={styles.options}>
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

      <Modal visible={quitOpen} transparent animationType="fade" onRequestClose={() => setQuitOpen(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Шалгалтаас гарах уу?</Text>
            <Text style={styles.confirmSub}>
              Гарсан ч энэ шалгалт өдрийн эрхээс тоологдсон хэвээр үлдэнэ. Хариултууд хадгалагдсан
              тул буцаж орвол үргэлжлүүлэх боломжтой.
            </Text>
            <View style={{ gap: 10, marginTop: 16 }}>
              <PrimaryButton
                testID="quit-keep"
                title="Дараа үргэлжлүүлнэ"
                variant="secondary"
                onPress={() => {
                  setQuitOpen(false);
                  router.back();
                }}
              />
              <PrimaryButton
                testID="quit-abandon"
                title="Шалгалтыг цуцлах"
                variant="danger"
                loading={abandon.isPending}
                onPress={() => abandon.mutate()}
              />
              <PrimaryButton title="Үргэлжлүүлэх" onPress={() => setQuitOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Шалгалтыг дуусгах уу?</Text>
            <Text style={styles.confirmSub}>{answeredCount}/{questions.length} асуултад хариулсан байна.</Text>
            <View style={{ gap: 10, marginTop: 16 }}>
              <PrimaryButton
                testID="confirm-submit"
                title="Тийм, дуусгах"
                loading={submit.isPending}
                onPress={() => {
                  setConfirmOpen(false);
                  submit.mutate(false);
                }}
              />
              <PrimaryButton title="Үргэлжлүүлэх" variant="secondary" onPress={() => setConfirmOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
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
  hBtn: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  timer: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  timerText: { fontSize: 16, fontFamily: font.extrabold },
  counter: { color: colors.muted, fontSize: 14, fontFamily: font.bold, width: 44, textAlign: "right" },
  resumeBar: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 7,
    backgroundColor: colors.brandTertiary,
  },
  resumeText: { color: colors.onBrandTertiary, fontSize: 12, fontFamily: font.semibold },
  catBar: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: colors.brandTertiary,
  },
  catBarText: { color: colors.onBrandTertiary, fontSize: 13, fontFamily: font.semibold, flex: 1 },
  content: { padding: 20, paddingBottom: 24 },
  image: { width: "100%", height: 200, borderRadius: 14, backgroundColor: colors.surfaceTertiary, marginBottom: 16 },
  qNum: { color: colors.brandPrimary, fontSize: 13, fontFamily: font.bold, marginBottom: 6 },
  question: { color: colors.onSurface, fontSize: 17, lineHeight: 26, fontFamily: font.semibold, marginBottom: 20 },
  options: { gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  navRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  navBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  confirmBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 32 },
  confirmBox: { width: "100%", backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 22 },
  confirmTitle: { color: colors.onSurface, fontSize: 18, fontFamily: font.bold },
  confirmSub: { color: colors.muted, fontSize: 14, marginTop: 6, fontFamily: font.regular },
}));
