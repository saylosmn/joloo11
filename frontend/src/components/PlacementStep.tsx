// Five questions during onboarding to estimate where someone is starting from.
//
// Answers are graded on the device and deliberately not recorded: this is a
// temperature check, not practice, so it does not spend the daily quota or skew
// the statistics the rest of the app is built on.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/src/components/AppText";
import { AnswerOption, OptionState } from "@/src/components/AnswerOption";
import { ProgressRing } from "@/src/components/ProgressRing";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { PrimaryButton, ProgressBar } from "@/src/components/ui";
import { api, imageUrl } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

const COUNT = 5;
const RESULT_KEY = "zhd_placement_percent";

type Q = {
  question_id: string;
  num: number;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
  correctKey: string;
};

export function PlacementStep({ onDone }: { onDone: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const { data, isFetching, refetch } = useQuery<Q[]>({
    queryKey: ["placement"],
    queryFn: () => api.get(`/questions/random?count=${COUNT}`),
    enabled: phase !== "intro",
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  const questions = data ?? [];
  const current = questions[Math.min(idx, Math.max(0, questions.length - 1))];
  const correct = questions.filter((q) => picked[q.question_id] === q.correctKey).length;
  const answeredCount = Object.keys(picked).length;

  const optionState = (key: string): OptionState => {
    const sel = current ? picked[current.question_id] : undefined;
    if (!sel || !current) return "default";
    if (key === current.correctKey) return "correct";
    if (key === sel) return "wrong";
    return "default";
  };

  const pick = (key: string) => {
    if (!current || picked[current.question_id]) return;
    const ok = key === current.correctKey;
    Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
    setPicked((p) => ({ ...p, [current.question_id]: key }));
  };

  const next = () => {
    if (idx < questions.length - 1) {
      setIdx(idx + 1);
      return;
    }
    const pct = Math.round((correct / Math.max(1, questions.length)) * 100);
    storage.setItem(RESULT_KEY, pct).catch(() => {});
    setPhase("result");
  };

  if (phase === "intro") {
    return (
      <View style={styles.centered}>
        <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name="speedometer" size={44} color={colors.brandPrimary} />
        </View>
        <Text style={styles.title}>Хэр бэлэн байгаагаа шалгах уу?</Text>
        <Text style={styles.body}>
          {COUNT} асуулт — нэг минут ч болохгүй. Хариулт нь статистикт тооцогдохгүй,
          зүгээр л хаанаас эхлэхээ мэдэх болно.
        </Text>
        <View style={{ alignSelf: "stretch", gap: spacing.md, marginTop: spacing.lg }}>
          <PrimaryButton
            title="Тийм, шалгая"
            icon="play"
            testID="placement-start"
            onPress={() => {
              setPhase("quiz");
              refetch();
            }}
          />
          <PrimaryButton title="Алгасах" variant="secondary" onPress={onDone} testID="placement-skip" />
        </View>
      </View>
    );
  }

  if (phase === "result") {
    const pct = Math.round((correct / Math.max(1, questions.length)) * 100);
    const advice =
      pct >= 70
        ? "Сайн суурьтай байна. Жинхэнэ шалгалтын горимоор дасгалжвал хангалттай."
        : pct >= 40
          ? "Эхлэл сайн. Сул бүлгүүддээ төвлөрвөл хурдан ахина."
          : "Эхнээс нь тайван эхэлье. Өдөрт 20 асуулт хийвэл хэдхэн долоо хоногт өөрчлөгдөнө.";

    return (
      <View style={styles.centered}>
        <ProgressRing size={150} stroke={12} percent={pct} color={pct >= 70 ? colors.success : colors.brandPrimary}>
          <Text style={[styles.resultPct, { color: pct >= 70 ? colors.success : colors.brandPrimary }]}>
            {pct}%
          </Text>
          <Text style={styles.resultSub}>
            {correct}/{questions.length}
          </Text>
        </ProgressRing>
        <Text style={styles.title}>Та {pct}% бэлэн байна</Text>
        <Text style={styles.body}>{advice}</Text>
        <View style={{ alignSelf: "stretch", marginTop: spacing.lg }}>
          <PrimaryButton title="Үргэлжлүүлэх" icon="arrow-forward" onPress={onDone} testID="placement-continue" />
        </View>
      </View>
    );
  }

  if (isFetching && questions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>Асуулт бэлдэж байна...</Text>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>Асуулт ачаалж чадсангүй.</Text>
        <View style={{ alignSelf: "stretch", marginTop: spacing.md }}>
          <PrimaryButton title="Алгасах" variant="secondary" onPress={onDone} />
        </View>
      </View>
    );
  }

  const answered = !!picked[current.question_id];

  return (
    <ScrollView contentContainerStyle={styles.quizWrap} showsVerticalScrollIndicator={false}>
      <View style={styles.quizHead}>
        <Text style={styles.counter}>
          {idx + 1} / {questions.length}
        </Text>
        <Text style={styles.counterRight}>{answeredCount} хариулсан</Text>
      </View>
      <ProgressBar percent={((idx + 1) / questions.length) * 100} height={5} shimmer={false} />

      {current.imageUrl ? (
        <QuestionImage uri={imageUrl(current.imageUrl)} height={150} style={{ marginTop: spacing.lg }} />
      ) : null}

      <Text style={styles.question}>{current.questionText}</Text>

      <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
        {current.options.map((o) => (
          <AnswerOption
            key={o.key}
            optionKey={o.key}
            text={o.text}
            state={optionState(o.key)}
            disabled={answered}
            onPress={() => pick(o.key)}
            testID={`placement-option-${o.key}`}
          />
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <PrimaryButton
          title={idx < questions.length - 1 ? "Дараагийн" : "Дүнг харах"}
          onPress={next}
          disabled={!answered}
          testID="placement-next"
        />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 110,
    height: 110,
    borderRadius: radius.xxl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: type.xxl, fontFamily: font.extrabold, textAlign: "center", marginTop: spacing.md },
  body: {
    color: colors.muted,
    fontSize: type.md,
    lineHeight: 23,
    textAlign: "center",
    fontFamily: font.regular,
    maxWidth: 340,
  },
  resultPct: { fontSize: type.display, fontFamily: font.extrabold },
  resultSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.bold },
  quizWrap: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  quizHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counter: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  counterRight: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  question: {
    color: colors.onSurface,
    fontSize: type.lg,
    lineHeight: 26,
    fontFamily: font.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
}));
