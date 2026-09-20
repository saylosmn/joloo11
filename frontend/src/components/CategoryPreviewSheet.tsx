// A taste of a locked chapter: one real question, answerable, with the upsell
// underneath. The answer is graded on the device and is never recorded, so this
// is a preview and not a way to work through paid content.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AnswerOption, OptionState } from "@/src/components/AnswerOption";
import { Text } from "@/src/components/AppText";
import { Sheet } from "@/src/components/Sheet";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { PrimaryButton } from "@/src/components/ui";
import { api, imageUrl } from "@/src/lib/api";
import { categoryShortName } from "@/src/lib/category-visual";
import { playAnswerSound } from "@/src/lib/sounds";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

type Preview = {
  category: { category_id: string; name: string; questionCount: number };
  question: {
    question_id: string;
    num: number;
    questionText: string;
    imageUrl?: string | null;
    options: { key: string; text: string }[];
    correctKey: string;
    explanation?: string;
  };
  trialAvailable: boolean;
  trialDays: number;
};

export function CategoryPreviewSheet({
  categoryId,
  visible,
  onClose,
  onUpgrade,
}: {
  categoryId: string | null;
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);

  const { data, isFetching } = useQuery<Preview>({
    queryKey: ["category-preview", categoryId],
    queryFn: () => api.get(`/categories/${categoryId}/preview`),
    enabled: visible && !!categoryId,
    staleTime: 5 * 60 * 1000,
  });

  const trial = useMutation({
    mutationFn: () => api.post("/pro/trial"),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["limits"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onClose();
      router.push("/pro/success?via=trial" as never);
    },
    onError: (e: any) => setTrialError(e?.message ?? "Идэвхжүүлж чадсангүй"),
  });

  const q = data?.question;
  const optionState = (key: string): OptionState => {
    if (!picked || !q) return "default";
    if (key === q.correctKey) return "correct";
    if (key === picked) return "wrong";
    return "default";
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setPicked(null);
        setTrialError(null);
        onClose();
      }}
      title="Түгжээтэй бүлгийн жишээ"
      snapPoints={["85%"]}
      testID="category-preview"
    >
      {isFetching && !data ? (
        <Text style={styles.loading}>Ачааллаж байна...</Text>
      ) : !data || !q ? (
        <Text style={styles.loading}>Жишээ асуулт олдсонгүй.</Text>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.head}>
            <View style={styles.lockIcon}>
              <Ionicons name="lock-closed" size={16} color={colors.onWarningSubtle} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.catName}>{categoryShortName(data.category.name)}</Text>
              <Text style={styles.catMeta}>{data.category.questionCount} асуулт · PRO</Text>
            </View>
          </View>

          {q.imageUrl ? <QuestionImage uri={imageUrl(q.imageUrl)} height={160} /> : null}
          <Text style={styles.question}>{q.questionText}</Text>

          <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
            {q.options.map((o) => (
              <AnswerOption
                key={o.key}
                optionKey={o.key}
                text={o.text}
                state={optionState(o.key)}
                disabled={!!picked}
                testID={`preview-option-${o.key}`}
                onPress={() => {
                  const ok = o.key === q.correctKey;
                  playAnswerSound(ok);
                  Haptics.notificationAsync(
                    ok
                      ? Haptics.NotificationFeedbackType.Success
                      : Haptics.NotificationFeedbackType.Error,
                  ).catch(() => {});
                  setPicked(o.key);
                }}
              />
            ))}
          </View>

          {picked && q.explanation ? (
            <View style={styles.explain}>
              <Text style={styles.explainText}>{q.explanation}</Text>
            </View>
          ) : null}

          <View style={styles.upsell}>
            <Text style={styles.upsellText}>
              Энэ бүлгийн үлдсэн {Math.max(0, data.category.questionCount - 1)} асуулт PRO-д нээлттэй.
            </Text>
          </View>

          {data.trialAvailable ? (
            <PrimaryButton
              title={`${data.trialDays} хоног үнэгүй туршиж үзэх`}
              icon="gift"
              loading={trial.isPending}
              onPress={() => trial.mutate()}
              testID="preview-trial"
            />
          ) : null}
          <PrimaryButton
            title="PRO болох"
            icon="star"
            variant={data.trialAvailable ? "secondary" : "primary"}
            onPress={onUpgrade}
            testID="preview-upgrade"
          />
          {trialError ? <Text style={styles.error}>{trialError}</Text> : null}
        </View>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  loading: { color: colors.muted, fontSize: type.base, fontFamily: font.regular, paddingVertical: spacing.xl },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lockIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  catMeta: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
  question: { color: colors.onSurface, fontSize: type.md, lineHeight: 24, fontFamily: font.semibold },
  explain: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  explainText: { color: colors.onSurfaceSecondary, fontSize: type.base, lineHeight: 21, fontFamily: font.regular },
  upsell: {
    backgroundColor: colors.warningSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  upsellText: { color: colors.onWarningSubtle, fontSize: type.base, lineHeight: 20, fontFamily: font.semibold },
  error: { color: colors.error, fontSize: type.sm, fontFamily: font.medium },
}));
