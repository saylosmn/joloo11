import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { BadgeGrid, LevelCard, type Achievements } from "@/src/components/Achievements";
import { BarChart, Legend, TrendLine, type BarDatum } from "@/src/components/Charts";
import { Leaderboard } from "@/src/components/Leaderboard";
import { ProgressRing } from "@/src/components/ProgressRing";
import { ProModal } from "@/src/components/ProModal";
import { StatsSkeleton } from "@/src/components/Skeleton";
import { Card, EmptyIllustration, ErrorState, FadeInView, PrimaryButton, ProgressBar } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { categoryShortName, categoryVisual } from "@/src/lib/category-visual";
import { useResponsive } from "@/src/lib/responsive";
import { useBottomTabBarHeight } from "@/src/lib/tab-bar";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

const WEEKDAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
const PASS_THRESHOLD = 75;

export default function Stats() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [proOpen, setProOpen] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();
  const { contentWidthStyle } = useResponsive();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get("/stats"),
  });
  const limits = useQuery({ queryKey: ["limits"], queryFn: () => api.get("/me/limits") });
  const achievements = useQuery<Achievements>({
    queryKey: ["achievements"],
    queryFn: () => api.get("/achievements"),
  });
  const isPro = limits.data?.isPro;

  const week: BarDatum[] = useMemo(() => {
    const days: { date: string; questionsAnswered: number }[] = (data?.dailyActivity || []).slice(-7);
    const today = new Date().toISOString().slice(0, 10);
    return days.map((d) => ({
      label: WEEKDAYS[new Date(d.date + "T00:00:00").getDay()],
      value: d.questionsAnswered || 0,
      highlight: d.date === today,
    }));
  }, [data]);

  const trend = useMemo(
    () =>
      ((data?.recentExams || []) as any[])
        .slice(0, 10)
        .reverse()
        .map((e) => ({ percent: e.percent, passed: e.passed })),
    [data],
  );

  // Weakest categories: lowest accuracy among those actually practised. A few
  // answers is not evidence, so anything under five is ignored.
  const weak = ((data?.perCategory || []) as any[])
    .filter((c) => c.answered >= 5)
    .map((c) => ({ ...c, accuracy: Math.round((c.correct / Math.max(1, c.answered)) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  if (isLoading) return <StatsSkeleton topInset={insets.top} />;
  if (isError && !data) return <ErrorState onRetry={refetch} />;

  const s = data;
  const activeCats = (s.perCategory || []).filter((c: any) => c.answered > 0);
  const weekTotal = week.reduce((a, b) => a + b.value, 0);
  const bestDay = week.reduce((a, b) => (b.value > a ? b.value : a), 0);
  const passRate = s.examsTaken ? Math.round((s.examsPassed / s.examsTaken) * 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[
        styles.content,
        contentWidthStyle,
        { paddingTop: insets.top + spacing.md, paddingBottom: tabBarHeight + spacing.xl },
      ]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Статистик</Text>

      {s.currentStreak > 0 ? (
        <FadeInView>
          <View style={styles.streakCard}>
            <View style={styles.streakIcon}>
              <Ionicons name="flame" size={26} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakValue}>{s.currentStreak} өдөр дараалан</Text>
              <Text style={styles.streakSub}>Нийт {s.studyDays || 0} өдөр суралцсан</Text>
            </View>
            <Ionicons name="flame" size={18} color={colors.warning} />
          </View>
        </FadeInView>
      ) : null}

      {achievements.data ? (
        <FadeInView delay={20}>
          <LevelCard data={achievements.data} />
        </FadeInView>
      ) : null}

      {/* Accuracy donut + headline numbers */}
      <FadeInView delay={40}>
        <Card style={styles.donutCard} level={1}>
          <ProgressRing
            size={124}
            stroke={11}
            percent={s.correctPercent || 0}
            color={colors.success}
            trackColor={colors.surfaceTertiary}
          >
            <Text style={styles.donutValue}>{s.correctPercent || 0}%</Text>
            <Text style={styles.donutLabel}>зөв</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: spacing.md }}>
            <View>
              <Text style={styles.donutBig}>{s.totalAnswered || 0}</Text>
              <Text style={styles.donutCaption}>нийт хариулт</Text>
            </View>
            <View style={{ gap: 6 }}>
              <View style={styles.splitRow}>
                <View style={[styles.splitDot, { backgroundColor: colors.success }]} />
                <Text style={styles.splitText}>{s.correct || 0} зөв</Text>
              </View>
              <View style={styles.splitRow}>
                <View style={[styles.splitDot, { backgroundColor: colors.error }]} />
                <Text style={styles.splitText}>{s.wrong || 0} буруу</Text>
              </View>
            </View>
          </View>
        </Card>
      </FadeInView>

      {/* Seven-day activity */}
      <FadeInView delay={80}>
        <Card style={{ gap: spacing.md }} level={1}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Сүүлийн 7 хоног</Text>
              <Text style={styles.cardSub}>
                {weekTotal} асуулт · өдөрт дунджаар {Math.round(weekTotal / 7)}
              </Text>
            </View>
            <View style={styles.trendChip}>
              <Ionicons name="trending-up" size={13} color={colors.brandPrimary} />
              <Text style={styles.trendChipText}>{bestDay} хамгийн их</Text>
            </View>
          </View>
          <BarChart data={week} height={150} />
        </Card>
      </FadeInView>

      <View style={styles.grid}>
        <Metric icon="checkbox-outline" color={colors.brandPrimary} value={s.totalAnswered} label="Хариулсан" />
        <Metric icon="trending-up" color={colors.success} value={`${s.correctPercent}%`} label="Зөв хувь" />
        <Metric icon="school-outline" color={colors.info} value={s.examsTaken} label="Шалгалт" />
        <Metric icon="ribbon-outline" color={colors.warning} value={s.examsPassed} label="Тэнцсэн" />
      </View>

      {/* Exam trend */}
      {trend.length > 1 ? (
        <FadeInView delay={120}>
          <Card style={{ gap: spacing.md }} level={1}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Шалгалтын хандлага</Text>
                <Text style={styles.cardSub}>Сүүлийн {trend.length} шалгалт · {passRate}% тэнцсэн</Text>
              </View>
            </View>
            <TrendLine values={trend} threshold={PASS_THRESHOLD} />
            <Legend
              items={[
                { color: colors.success, label: "Тэнцсэн" },
                { color: colors.error, label: "Тэнцээгүй" },
              ]}
            />
          </Card>
        </FadeInView>
      ) : null}

      {weak.length > 0 ? (
        <FadeInView delay={140}>
          <Card style={{ gap: spacing.md }} level={1} testID="weak-card">
            <View style={styles.cardHead}>
              <View style={[styles.weakIcon, { backgroundColor: colors.errorSubtle }]}>
                <Ionicons name="trending-down" size={18} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Сул талууд</Text>
                <Text style={styles.cardSub}>Хамгийн бага зөв хувьтай бүлгүүд</Text>
              </View>
            </View>

            {weak.map((c: any) => {
              const visual = categoryVisual(c.name);
              return (
                <Pressable
                  key={c.category_id}
                  testID={`weak-${c.category_id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${categoryShortName(c.name)}, ${c.accuracy} хувь зөв. Давтах`}
                  onPress={() => router.push(`/practice/${c.category_id}`)}
                  style={({ pressed }) => [styles.weakRow, pressed && { opacity: 0.9 }]}
                >
                  <View style={[styles.catIcon, { backgroundColor: visual.color + "22" }]}>
                    <Ionicons name={visual.icon as any} size={16} color={visual.color} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.weakName} numberOfLines={1}>{categoryShortName(c.name)}</Text>
                    <ProgressBar
                      percent={c.accuracy}
                      tone={c.accuracy < 50 ? "error" : c.accuracy < 75 ? "warning" : "success"}
                      height={6}
                      shimmer={false}
                    />
                  </View>
                  <Text style={[styles.weakPct, { color: c.accuracy < 50 ? colors.error : colors.warning }]}>
                    {c.accuracy}%
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              );
            })}

            <PrimaryButton
              title="15 асуултаар засах"
              icon="flash"
              variant="secondary"
              testID="weak-fix-button"
              // cast: expo-router regenerates typed routes on the next dev run
              onPress={() => router.push("/quick/weak" as never)}
            />
          </Card>
        </FadeInView>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Найзууд</Text>
      </View>
      <FadeInView delay={60}>
        <Leaderboard />
      </FadeInView>

      {achievements.data ? (
        <>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Тэмдэг</Text>
            <Text style={styles.cardSub}>
              {achievements.data.badges.filter((b) => b.earned).length}/{achievements.data.badges.length}
            </Text>
          </View>
          <BadgeGrid badges={achievements.data.badges} />
        </>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Бүлгийн гүйцэтгэл</Text>
        {!isPro ? <Ionicons name="lock-closed" size={16} color={colors.muted} /> : null}
      </View>

      {!isPro ? (
        <Pressable style={styles.lockCard} onPress={() => setProOpen(true)} testID="stats-pro-lock" accessibilityRole="button">
          <Ionicons name="stats-chart" size={28} color={colors.brandPrimary} />
          <Text style={styles.lockTitle}>Дэлгэрэнгүй статистик</Text>
          <Text style={styles.lockSub}>Бүлэг бүрийн гүйцэтгэлийг харахын тулд PRO болно уу.</Text>
        </Pressable>
      ) : activeCats.length === 0 ? (
        <Card>
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm }}>
            <EmptyIllustration icon="bar-chart-outline" tone="brand" size={110} />
            <Text style={styles.emptyText}>Дасгал хийж эхэлмэгц энд гүйцэтгэл харагдана.</Text>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {activeCats.map((c: any, i: number) => {
            const visual = categoryVisual(c.name);
            return (
              <FadeInView key={c.category_id} delay={Math.min(i, 8) * 40}>
                <Card style={{ gap: spacing.sm }} level={1}>
                  <View style={styles.catHead}>
                    <View style={[styles.catIcon, { backgroundColor: visual.color + "22" }]}>
                      <Ionicons name={visual.icon as any} size={16} color={visual.color} />
                    </View>
                    <Text style={styles.catName} numberOfLines={1}>{categoryShortName(c.name)}</Text>
                    <Text style={[styles.catPct, { color: visual.color }]}>{c.percent}%</Text>
                  </View>
                  <ProgressBar percent={c.percent} shimmer={false} />
                  <Text style={styles.catSub}>{c.correct}/{c.questionCount} зөв</Text>
                </Card>
              </FadeInView>
            );
          })}
        </View>
      )}

      <ProModal
        visible={proOpen}
        onClose={() => setProOpen(false)}
        profileName={user?.profileName}
        reason="Дэлгэрэнгүй статистик зөвхөн PRO хэрэглэгчдэд."
      />
    </ScrollView>
  );
}

function Metric({ icon, color, value, label }: any) {
  const styles = useStyles();
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.metricIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.metricValue}>{value ?? 0}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { padding: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { color: colors.onSurface, fontSize: type.title, fontFamily: font.extrabold },

  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.warningSubtle,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  streakIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: "rgba(245,158,11,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakValue: { color: colors.onWarningSubtle, fontSize: type.lg, fontFamily: font.extrabold },
  streakSub: { color: colors.onWarningSubtle, fontSize: type.sm, fontFamily: font.medium, opacity: 0.85 },

  donutCard: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  donutValue: { color: colors.onSurface, fontSize: type.xxl, fontFamily: font.extrabold },
  donutLabel: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium, marginTop: -2 },
  donutBig: { color: colors.onSurface, fontSize: type.display, fontFamily: font.extrabold },
  donutCaption: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  splitDot: { width: 10, height: 10, borderRadius: 3 },
  splitText: { color: colors.onSurfaceSecondary, fontSize: type.base, fontFamily: font.semibold },

  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  cardTitle: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
  cardSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular, marginTop: 2 },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  trendChipText: { color: colors.onBrandTertiary, fontSize: type.xs, fontFamily: font.bold },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.elev1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  metricIcon: { width: 34, height: 34, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  metricValue: { color: colors.onSurface, fontSize: type.xxl, fontFamily: font.extrabold },
  metricLabel: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { color: colors.onSurface, fontSize: type.xl, fontFamily: font.bold },

  lockCard: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockTitle: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
  lockSub: { color: colors.muted, fontSize: type.base, textAlign: "center", fontFamily: font.regular, lineHeight: 20 },

  weakIcon: { width: 34, height: 34, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center" },
  weakRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  weakName: { color: colors.onSurface, fontSize: type.base, fontFamily: font.semibold },
  weakPct: { fontSize: type.base, fontFamily: font.extrabold, minWidth: 40, textAlign: "right" },
  catHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catIcon: { width: 28, height: 28, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center" },
  catName: { flex: 1, color: colors.onSurface, fontSize: type.base, fontFamily: font.semibold },
  catPct: { fontSize: type.base, fontFamily: font.extrabold },
  catSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
  emptyText: { color: colors.muted, fontSize: type.base, fontFamily: font.regular, textAlign: "center" },
}));
