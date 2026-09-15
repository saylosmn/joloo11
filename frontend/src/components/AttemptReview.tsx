// Shared exam-review UI used by both the post-exam result screen and the
// "past attempt" detail screen. Renders a score hero, summary stats, a
// All / Wrong-only filter, the per-question breakdown, and a share action.
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/src/components/ui";
import { imageUrl } from "@/src/lib/api";
import { font, makeStyles, useTheme } from "@/src/theme";

export type AttemptDetailItem = {
  question_id: string;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
  selectedKey?: string | null;
  correctKey: string;
  explanation?: string;
  isCorrect: boolean;
};

export type AttemptLike = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  durationSeconds?: number;
  category_name?: string | null;
  finishedAt?: string;
  detail: AttemptDetailItem[];
};

function fmtDuration(sec?: number) {
  if (!sec && sec !== 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} мин ${String(s).padStart(2, "0")} сек`;
}

export function AttemptReview({
  data,
  footer,
  heroTopPadding,
}: {
  data: AttemptLike;
  footer?: React.ReactNode;
  heroTopPadding?: number;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [onlyWrong, setOnlyWrong] = useState(true);
  const heroTop = heroTopPadding ?? insets.top + 24;

  const passed = data.passed;
  const accent = passed ? colors.success : colors.error;
  const wrongCount = data.detail.filter((d) => !d.isCorrect).length;
  const duration = fmtDuration(data.durationSeconds);

  const shown = useMemo(
    () => (onlyWrong ? data.detail.filter((d) => !d.isCorrect) : data.detail),
    [onlyWrong, data.detail],
  );

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const line = passed ? "Тэнцлээ ✅" : "Дахин оролдоно 💪";
    try {
      await Share.share({
        message:
          `🚗 ЗХД шалгалт — ${data.score}/${data.total} (${data.percent}%) ${line}\n` +
          `${data.category_name ? data.category_name + "\n" : ""}` +
          `Замын хөдөлгөөний дүрмийн шалгалтад бэлдэж байна.`,
      });
    } catch {
      /* user dismissed */
    }
  };

  return (
    <>
      <View style={[styles.hero, { paddingTop: heroTop, backgroundColor: passed ? colors.successSubtle : colors.errorSubtle }]}>
        <View style={[styles.heroIcon, { backgroundColor: accent }]}>
          <Ionicons name={passed ? "trophy" : "refresh"} size={36} color="#FFFFFF" />
        </View>
        <Text style={[styles.heroPct, { color: accent }]} testID="result-percent">{data.percent}%</Text>
        <Text style={[styles.heroStatus, { color: accent }]}>{passed ? "Тэнцлээ! 🎉" : "Дахин оролдоорой"}</Text>
        <Text style={styles.heroScore}>{data.score}/{data.total} зөв хариулсан</Text>
        {data.category_name ? <Text style={styles.heroCat}>{data.category_name}</Text> : null}
        {data.finishedAt || duration ? (
          <Text style={styles.heroMeta}>
            {(data.finishedAt || "").slice(0, 10)}{duration ? `  ·  ${duration}` : ""}
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.summaryRow}>
          <SummaryStat icon="checkmark-circle" color={colors.success} label="Зөв" value={data.score} />
          <SummaryStat icon="close-circle" color={colors.error} label="Буруу" value={data.total - data.score} />
          <SummaryStat icon="ribbon" color={colors.brandPrimary} label="Босго" value="75%" />
        </View>

        <Pressable style={styles.shareBtn} onPress={share} testID="share-result">
          <Ionicons name="share-social-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.shareText}>Дүнгээ хуваалцах</Text>
        </Pressable>

        {wrongCount > 0 ? (
          <View style={styles.filterRow}>
            <Text style={styles.sectionTitle}>Асуултын задаргаа</Text>
            <View style={styles.toggle}>
              <Pressable
                onPress={() => setOnlyWrong(true)}
                style={[styles.toggleItem, onlyWrong && { backgroundColor: colors.brandPrimary }]}
              >
                <Text style={[styles.toggleText, { color: onlyWrong ? colors.onBrandPrimary : colors.muted }]}>Буруу ({wrongCount})</Text>
              </Pressable>
              <Pressable
                onPress={() => setOnlyWrong(false)}
                style={[styles.toggleItem, !onlyWrong && { backgroundColor: colors.brandPrimary }]}
              >
                <Text style={[styles.toggleText, { color: !onlyWrong ? colors.onBrandPrimary : colors.muted }]}>Бүгд ({data.total})</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Card style={{ marginTop: 4 }}>
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
              <Ionicons name="sparkles" size={28} color={colors.success} />
              <Text style={styles.perfect}>Бүх асуултад зөв хариуллаа!</Text>
            </View>
          </Card>
        )}

        <View style={{ gap: 12, marginTop: 12 }}>
          {shown.map((d, i) => (
            <Card key={d.question_id} style={{ gap: 10 }}>
              {d.imageUrl ? (
                <Image source={{ uri: imageUrl(d.imageUrl) }} style={styles.wImg} contentFit="contain" />
              ) : null}
              <View style={styles.qHead}>
                <View style={[styles.qBadge, { backgroundColor: d.isCorrect ? colors.successSubtle : colors.errorSubtle }]}>
                  <Ionicons name={d.isCorrect ? "checkmark" : "close"} size={14} color={d.isCorrect ? colors.success : colors.error} />
                </View>
                <Text style={styles.wQuestion}>{i + 1}. {d.questionText}</Text>
              </View>
              {d.options.map((o) => {
                const isCorrect = o.key === d.correctKey;
                const isPicked = o.key === d.selectedKey;
                if (!isCorrect && !isPicked) return null;
                return (
                  <View key={o.key} style={[styles.wOpt, { backgroundColor: isCorrect ? colors.successSubtle : colors.errorSubtle }]}>
                    <Ionicons name={isCorrect ? "checkmark-circle" : "close-circle"} size={18} color={isCorrect ? colors.success : colors.error} />
                    <Text style={[styles.wOptText, { color: isCorrect ? colors.onSuccessSubtle : colors.onErrorSubtle }]}>
                      {o.text}{isPicked && !isCorrect ? "  (таны сонголт)" : ""}
                    </Text>
                  </View>
                );
              })}
              {!d.selectedKey && !d.isCorrect ? (
                <Text style={styles.skipped}>Хариулаагүй орхисон</Text>
              ) : null}
              {d.explanation ? <Text style={styles.wExplain}>{d.explanation}</Text> : null}
            </Card>
          ))}
        </View>

        {footer}
      </View>
    </>
  );
}

function SummaryStat({ icon, color, label, value }: any) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { alignItems: "center", paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  heroPct: { fontSize: 48, fontFamily: font.extrabold },
  heroStatus: { fontSize: 20, fontFamily: font.bold, marginTop: 2 },
  heroScore: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 6, fontFamily: font.medium },
  heroCat: { color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: font.medium },
  heroMeta: { color: colors.muted, fontSize: 12, marginTop: 6, fontFamily: font.regular },
  body: { padding: 20 },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  stat: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14,
    alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { color: colors.onSurface, fontSize: 20, fontFamily: font.extrabold },
  statLabel: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brandTertiary, borderRadius: 14, paddingVertical: 13, marginBottom: 8,
  },
  shareText: { color: colors.brandPrimary, fontSize: 15, fontFamily: font.bold },
  filterRow: { marginTop: 14, gap: 10 },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontFamily: font.bold },
  toggle: { flexDirection: "row", gap: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: 4 },
  toggleItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9 },
  toggleText: { fontSize: 13, fontFamily: font.bold },
  wImg: { width: "100%", height: 160, borderRadius: 12, backgroundColor: colors.surfaceTertiary },
  qHead: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  qBadge: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  wQuestion: { flex: 1, color: colors.onSurface, fontSize: 15, lineHeight: 22, fontFamily: font.semibold },
  wOpt: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10 },
  wOptText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: font.medium },
  skipped: { color: colors.muted, fontSize: 13, fontFamily: font.medium, fontStyle: "italic" },
  wExplain: { color: colors.muted, fontSize: 13, lineHeight: 20, fontFamily: font.regular, marginTop: 2 },
  perfect: { color: colors.onSurface, fontSize: 16, fontFamily: font.bold },
}));
