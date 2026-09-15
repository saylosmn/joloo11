import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnswerOption, OptionState } from "@/src/components/AnswerOption";
import { ProModal } from "@/src/components/ProModal";
import { EmptyState, ErrorState, LoadingView, PrimaryButton } from "@/src/components/ui";
import { ApiError, api, imageUrl } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { font, makeStyles, useTheme } from "@/src/theme";

type Q = {
  question_id: string;
  num: number;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation?: string;
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
  const [proOpen, setProOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<Q[]>({
    queryKey: ["review", mode],
    queryFn: () => api.get(isWrong ? "/questions/wrong" : "/questions/bookmarked"),
    retry: false,
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answerMut = useMutation({
    mutationFn: (p: { question_id: string; selectedKey: string }) => api.post("/practice/answer", p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const title = isWrong ? "Алдаатай асуултууд" : "Тэмдэглэсэн асуултууд";

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable testID="review-back" onPress={() => router.back()} hitSlop={10} style={styles.hBtn}>
        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.hTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.hBtn} />
    </View>
  );

  if (isLoading)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <LoadingView />
      </View>
    );

  if (error) {
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

  const questions = data || [];
  if (questions.length === 0)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <EmptyState
          icon={isWrong ? "checkmark-done-circle-outline" : "bookmark-outline"}
          title={isWrong ? "Алдаа алга" : "Тэмдэглэсэн асуулт алга"}
          subtitle={isWrong ? "Одоогоор буруу хариулсан асуулт байхгүй байна." : "Дасгал хийхдээ асуулт тэмдэглэж болно."}
        />
      </View>
    );

  const current = questions[Math.min(idx, questions.length - 1)];
  const selected = answers[current.question_id];
  const answered = selected != null;

  const optionState = (key: string): OptionState => {
    if (!answered) return "default";
    if (key === current.correctKey) return "correct";
    if (key === selected) return "wrong";
    return "default";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {Header}
      <View style={styles.counterRow}>
        <Text style={styles.counter}>{idx + 1} / {questions.length}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {current.imageUrl ? (
          <Image source={{ uri: imageUrl(current.imageUrl) }} style={styles.image} contentFit="contain" transition={150} />
        ) : null}
        <Text style={styles.qNum}>№ {current.num}</Text>
        <Text style={styles.question}>{current.questionText}</Text>
        <View style={styles.options}>
          {current.options.map((o) => (
            <AnswerOption
              key={o.key}
              testID={`option-${o.key}`}
              optionKey={o.key}
              text={o.text}
              state={optionState(o.key)}
              disabled={answered}
              onPress={() => {
                setAnswers((a) => ({ ...a, [current.question_id]: o.key }));
                answerMut.mutate({ question_id: current.question_id, selectedKey: o.key });
              }}
            />
          ))}
        </View>
        {answered && current.explanation ? (
          <View style={styles.explain}>
            <Text style={styles.explainText}>{current.explanation}</Text>
          </View>
        ) : null}
      </ScrollView>
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
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.surfaceSecondary,
  },
  hBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { flex: 1, textAlign: "center", color: colors.onSurface, fontSize: 16, fontFamily: font.bold },
  counterRow: { paddingHorizontal: 20, paddingTop: 12 },
  counter: { color: colors.muted, fontSize: 13, fontFamily: font.semibold },
  content: { padding: 20, paddingTop: 8, paddingBottom: 24 },
  image: { width: "100%", height: 200, borderRadius: 14, backgroundColor: colors.surfaceTertiary, marginBottom: 16 },
  qNum: { color: colors.brandPrimary, fontSize: 13, fontFamily: font.bold, marginBottom: 6 },
  question: { color: colors.onSurface, fontSize: 17, lineHeight: 26, fontFamily: font.semibold, marginBottom: 20 },
  options: { gap: 12 },
  explain: { marginTop: 18, backgroundColor: colors.brandTertiary, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  explainText: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 23, fontFamily: font.regular },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
}));
