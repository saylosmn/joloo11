// Shared exam-review UI used by both the post-exam result screen and the
// "past attempt" detail screen. Renders a score hero, summary stats, a
// All / Wrong-only filter, the per-question breakdown, and a share action.
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExamPassed } from "@/src/components/illustrations";

import { Text } from "@/src/components/AppText";
import { Confetti } from "@/src/components/Confetti";
import { QuestionHistory, QuestionTags } from "@/src/components/QuestionNoteSheet";
import { ProgressRing } from "@/src/components/ProgressRing";
import { QuestionImage } from "@/src/components/ZoomableImage";
import { Card, FadeInView } from "@/src/components/ui";
import { imageUrl } from "@/src/lib/api";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

export type AttemptDetailItem = {
  question_id: string;
  questionText: string;
  imageUrl?: string | null;
  options: { key: string; text: string }[];
  selectedKey?: string | null;
  correctKey: string;
  explanation?: string;
  isCorrect: boolean;
  seenCount?: number;
  wrongCount?: number;
  note?: string;
  tags?: string[];
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

/** Counts a number up to its target once, on mount. */
function useCountUp(target: number, ms = 900, enabled = true) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      // ease-out cubic, so it slows into the final number
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms, enabled]);

  return enabled ? value : target;
}

export function AttemptReview({
  data,
  footer,
  heroTopPadding,
  celebrate = false,
}: {
  data: AttemptLike;
  footer?: React.ReactNode;
  heroTopPadding?: number;
  /** True on the just-finished result screen: animates the ring and fires confetti. */
  celebrate?: boolean;
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
    // A small text "score card": bar, score, time — reads well in any chat app.
    const filled = Math.round(data.percent / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    try {
      await Share.share({
        message:
          `🚗 ЗХД шалгалт — ${line}\n` +
          `${bar}  ${data.percent}%\n` +
          `✅ ${data.score}/${data.total} зөв${duration ? `  ·  ⏱ ${duration}` : ""}\n` +
          `${data.category_name ? `📚 ${data.category_name}\n` : ""}` +
          `Тэнцэх босго 75%. Замын хөдөлгөөний дүрмийн шалгалтад бэлдэж байна.`,
      });
    } catch {
      /* user dismissed */
    }
  };

  const shownPercent = useCountUp(data.percent, 900, celebrate);

  return (
    <>
      <View style={[styles.hero, { paddingTop: heroTop }]}>
        <LinearGradient
          colors={[passed ? colors.successSubtle : colors.errorSubtle, colors.surface]}
          style={styles.heroBg}
        />
        {celebrate && passed ? <Confetti active height={420} /> : null}

        <View style={styles.ringWrap}>
          <ProgressRing
            size={168}
            stroke={13}
            percent={data.percent}
            color={accent}
            trackColor={colors.surfaceTertiary}
            animate={celebrate}
            duration={900}
          >
            <Text style={[styles.heroPct, { color: accent }]} testID="result-percent">
              {shownPercent}%
            </Text>
            <Text style={styles.heroScoreSmall}>
              {data.score}/{data.total}
            </Text>
          </ProgressRing>
          <View style={[styles.heroIcon, { backgroundColor: accent }]}>
            {passed ? (
              <ExamPassed size={40} />
            ) : (
              <Ionicons name="refresh" size={22} color="#FFFFFF" />
            )}
          </View>
        </View>

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

        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.9 }]}
          onPress={share}
          testID="share-result"
          accessibilityRole="button"
          accessibilityLabel="Дүнгээ хуваалцах"
        >
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

        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {shown.map((d, i) => (
            <FadeInView key={d.question_id} delay={Math.min(i, 8) * 40}>
            <Card style={{ gap: spacing.sm + 2 }}>
              {d.imageUrl ? <QuestionImage uri={imageUrl(d.imageUrl)} height={160} /> : null}
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
              <QuestionHistory seenCount={d.seenCount} wrongCount={d.wrongCount} compact />
              <QuestionTags tags={d.tags} note={d.note} />
            </Card>
            </FadeInView>
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
  hero: {
    alignItems: "center",
    paddingBottom: spacing.xl + 4,
    paddingHorizontal: spacing.gutter,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    overflow: "hidden",
  },
  heroBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  ringWrap: { alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  heroIcon: {
    position: "absolute",
    bottom: -6,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
  },
  heroPct: { fontSize: type.hero, fontFamily: font.extrabold },
  heroScoreSmall: { color: colors.muted, fontSize: type.sm, fontFamily: font.bold, marginTop: -4 },
  heroStatus: { fontSize: type.xl, fontFamily: font.bold, marginTop: spacing.sm },
  heroScore: { color: colors.onSurfaceSecondary, fontSize: type.base, marginTop: 6, fontFamily: font.medium },
  heroCat: { color: colors.muted, fontSize: type.sm, marginTop: 2, fontFamily: font.medium },
  heroMeta: { color: colors.muted, fontSize: type.sm, marginTop: 6, fontFamily: font.regular },
  body: { padding: spacing.gutter },
  summaryRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md + 2 },
  stat: {
    flex: 1, backgroundColor: colors.elev1, borderRadius: radius.lg, padding: spacing.md + 2,
    alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { color: colors.onSurface, fontSize: type.xl, fontFamily: font.extrabold },
  statLabel: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.brandTertiary, borderRadius: radius.md, paddingVertical: 13, marginBottom: spacing.sm,
  },
  shareText: { color: colors.brandPrimary, fontSize: type.md, fontFamily: font.bold },
  filterRow: { marginTop: spacing.md + 2, gap: spacing.sm + 2 },
  sectionTitle: { color: colors.onSurface, fontSize: type.xl, fontFamily: font.bold },
  toggle: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4 },
  toggleItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.sm + 3 },
  toggleText: { fontSize: type.sm, fontFamily: font.bold },
  qHead: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  qBadge: { width: 24, height: 24, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  wQuestion: { flex: 1, color: colors.onSurface, fontSize: type.md, lineHeight: 22, fontFamily: font.semibold },
  wOpt: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.sm + 4 },
  wOptText: { flex: 1, fontSize: type.base, lineHeight: 20, fontFamily: font.medium },
  skipped: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium, fontStyle: "italic" },
  wExplain: { color: colors.muted, fontSize: type.sm, lineHeight: 20, fontFamily: font.regular, marginTop: 2 },
  perfect: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
}));
