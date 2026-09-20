import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { HomeSkeleton } from "@/src/components/Skeleton";
import { AnimatedPressable, Badge, Card, FadeInView, ProgressBar, usePressScale } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useBottomTabBarHeight } from "@/src/lib/tab-bar";
import { categoryShortName, categoryVisual } from "@/src/lib/category-visual";
import { useReducedMotion } from "@/src/lib/motion";
import { rescheduleReminders } from "@/src/lib/notifications";
import { useAppUpdate } from "@/src/lib/updates";
import { TOTAL_CATEGORIES, TOTAL_QUESTIONS } from "@/src/lib/content";
import {
  DEFAULT_DAILY_GOAL,
  getDailyGoal,
  getLastCategory,
  getResume,
  setDailyGoal,
} from "@/src/lib/progress-local";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

const GOAL_STEPS = [10, 20, 30, 50];
const WEEKDAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

function greeting(): { text: string; icon: string } {
  const h = new Date().getHours();
  if (h < 5) return { text: "Сайхан амраарай,", icon: "moon" };
  if (h < 12) return { text: "Өглөөний мэнд,", icon: "sunny" };
  if (h < 18) return { text: "Өдрийн мэнд,", icon: "partly-sunny" };
  if (h < 22) return { text: "Оройн мэнд,", icon: "cloudy-night" };
  return { text: "Сайхан амраарай,", icon: "moon" };
}

export default function Home() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const update = useAppUpdate();

  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api.get("/stats") });
  const limits = useQuery({ queryKey: ["limits"], queryFn: () => api.get("/me/limits") });
  const cats = useQuery<any[]>({ queryKey: ["categories"], queryFn: () => api.get("/categories") });
  const achievements = useQuery<any>({ queryKey: ["achievements"], queryFn: () => api.get("/achievements") });
  const qc = useQueryClient();

  // One freeze a week can rescue a streak broken by a single missed day.
  const restoreStreak = useMutation({
    mutationFn: () => api.post("/streak/freeze"),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["achievements"] });
    },
  });

  const [goal, setGoal] = useState(DEFAULT_DAILY_GOAL);
  const [resume, setResumeState] = useState<{ id: string; name: string; idx: number; total: number } | null>(null);

  useEffect(() => {
    getDailyGoal().then(setGoal);
  }, []);

  // "Continue" card: the last practised category plus the saved position.
  useEffect(() => {
    let alive = true;
    (async () => {
      const id = await getLastCategory();
      if (!id || !cats.data) return;
      const cat = cats.data.find((c: any) => c.category_id === id);
      if (!cat || cat.locked) return;
      const idx = await getResume(id);
      if (alive && idx > 0) {
        setResumeState({ id, name: cat.name, idx, total: cat.questionCount });
      }
    })();
    return () => {
      alive = false;
    };
  }, [cats.data]);

  // Re-arm local reminders whenever today's numbers change: a met goal cancels
  // tonight's nudge, an empty day with a live streak adds the streak guard.
  const answeredTodayRaw = limits.data?.questionsAnswered;
  const streakRaw = stats.data?.currentStreak;
  useEffect(() => {
    if (answeredTodayRaw == null) return;
    rescheduleReminders({
      answeredToday: answeredTodayRaw,
      dailyGoal: goal,
      streak: streakRaw ?? 0,
    }).catch(() => {});
  }, [answeredTodayRaw, streakRaw, goal]);

  const cycleGoal = () => {
    const next = GOAL_STEPS[(GOAL_STEPS.indexOf(goal) + 1) % GOAL_STEPS.length] ?? DEFAULT_DAILY_GOAL;
    setGoal(next);
    setDailyGoal(next);
    Haptics.selectionAsync().catch(() => {});
  };

  const refreshing = stats.isRefetching || limits.isRefetching;
  const onRefresh = () => {
    stats.refetch();
    limits.refetch();
  };

  // Parallax hero + a compact blurred header that fades in on scroll.
  // `motion` is 0 when the user asked for less movement: the header still
  // appears, it just does not slide or scale.
  const reducedMotion = useReducedMotion();
  const motion = reducedMotion ? 0 : 1;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-120, 0, 200], [0, 0, 60], Extrapolation.CLAMP) * motion },
      { scale: 1 + (interpolate(scrollY.value, [-140, 0], [1.18, 1], Extrapolation.CLAMP) - 1) * motion },
    ],
  }));
  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 120], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, 200], [0, -24], Extrapolation.CLAMP) * motion },
    ],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [90, 150], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [90, 150], [-8, 0], Extrapolation.CLAMP) * motion },
    ],
  }));

  if (stats.isLoading || limits.isLoading) return <HomeSkeleton topInset={insets.top} />;

  const s = stats.data || {};
  const overall = Math.round(((s.totalAnswered || 0) / TOTAL_QUESTIONS) * 100);
  const isPro = limits.data?.isPro;
  const streak = s.currentStreak || 0;
  const answeredToday = limits.data?.questionsAnswered ?? 0;
  const goalPct = goal ? Math.min(100, Math.round((answeredToday / goal) * 100)) : 0;
  const goalDone = answeredToday >= goal;
  const week: { date: string; questionsAnswered: number; examsTaken: number }[] = (s.dailyActivity || []).slice(-7);
  const dueCount = s.dueCount || 0;
  const hello = greeting();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* compact header, revealed once the hero scrolls away */}
      <Animated.View style={[styles.compact, { paddingTop: insets.top }, compactStyle]} pointerEvents="none">
        <BlurView intensity={scheme === "dark" ? 40 : 60} tint={scheme === "dark" ? "dark" : "light"} style={styles.compactInner}>
          <Text style={styles.compactName} numberOfLines={1}>{user?.profileName}</Text>
          <View style={styles.compactRight}>
            {streak > 0 ? (
              <View style={styles.compactStreak}>
                <Ionicons name="flame" size={13} color={colors.warning} />
                <Text style={styles.compactStreakText}>{streak}</Text>
              </View>
            ) : null}
            <Text style={styles.compactPct}>{overall}%</Text>
          </View>
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} progressViewOffset={insets.top} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ overflow: "hidden", borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl }}>
          <Animated.View style={heroStyle}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
            >
              <Animated.View style={heroContentStyle}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.helloRow}>
                      <Ionicons name={hello.icon as any} size={14} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.hello}>{hello.text}</Text>
                    </View>
                    <Text style={styles.name} testID="home-profile-name" numberOfLines={1}>
                      {user?.profileName}
                    </Text>
                  </View>
                  <Badge label={isPro ? "PRO" : "FREE"} tone={isPro ? "success" : "muted"} icon={isPro ? "star" : "lock-closed"} />
                </View>

                {/* seven-day streak strip */}
                <View style={styles.weekRow} testID="home-streak">
                  {week.map((d) => {
                    const date = new Date(d.date + "T00:00:00");
                    const active = (d.questionsAnswered || 0) > 0 || (d.examsTaken || 0) > 0;
                    const isToday = d.date === new Date().toISOString().slice(0, 10);
                    return (
                      <View key={d.date} style={styles.weekItem}>
                        <View
                          style={[
                            styles.weekDot,
                            active && styles.weekDotActive,
                            isToday && { borderColor: "#FFFFFF", borderWidth: 2 },
                          ]}
                        >
                          {active ? <Ionicons name="flame" size={12} color="#FDBA74" /> : null}
                        </View>
                        <Text style={[styles.weekLabel, isToday && { color: "#FFFFFF", fontFamily: font.bold }]}>
                          {WEEKDAYS[date.getDay()]}
                        </Text>
                      </View>
                    );
                  })}
                  <View style={styles.streakTotal}>
                    <Text style={styles.streakTotalValue}>{streak}</Text>
                    <Text style={styles.streakTotalLabel}>өдөр</Text>
                  </View>
                </View>

                <View style={styles.heroCard}>
                  <View style={styles.heroCardRow}>
                    <Text style={styles.heroCardLabel}>Нийт гүйцэтгэл</Text>
                    <Text style={styles.heroCardPct}>{overall}%</Text>
                  </View>
                  <ProgressBar percent={overall} />
                  <Text style={styles.heroCardSub}>
                    {s.totalAnswered || 0} / {TOTAL_QUESTIONS} асуулт хариулсан · {s.correctPercent || 0}% зөв
                  </Text>
                </View>
              </Animated.View>
            </LinearGradient>
          </Animated.View>
        </View>

        <OfflineBanner />

        <View style={styles.body}>
          {update.ready ? (
            <FadeInView>
              <Pressable
                testID="update-ready"
                accessibilityRole="button"
                accessibilityLabel="Шинэчлэлт бэлэн — дахин эхлүүлэх"
                onPress={update.apply}
                style={({ pressed }) => [styles.updateCard, pressed && { opacity: 0.94 }]}
              >
                <View style={styles.updateIcon}>
                  <Ionicons name="cloud-download" size={20} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.updateTitle}>Шинэчлэлт бэлэн боллоо</Text>
                  <Text style={styles.updateSub}>Товшвол дахин ачаалж, шинэ хувилбар руу шилжинэ.</Text>
                </View>
                <Ionicons name="refresh" size={18} color={colors.success} />
              </Pressable>
            </FadeInView>
          ) : null}

          {achievements.data?.freeze?.canRestore ? (
            <FadeInView>
              <Pressable
                testID="streak-restore"
                accessibilityRole="button"
                accessibilityLabel="Streak-ээ сэргээх"
                onPress={() => restoreStreak.mutate()}
                disabled={restoreStreak.isPending}
                style={({ pressed }) => [styles.freezeCard, pressed && { opacity: 0.94 }]}
              >
                <View style={styles.freezeIcon}>
                  <Ionicons name="snow" size={22} color={colors.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.freezeTitle}>Streak тасарсан байна</Text>
                  <Text style={styles.freezeSub}>
                    Долоо хоногт нэг удаа сэргээж болно — товшоод streak-ээ буцааж ав.
                  </Text>
                </View>
                <Text style={styles.freezeAction}>
                  {restoreStreak.isPending ? "..." : "Сэргээх"}
                </Text>
              </Pressable>
            </FadeInView>
          ) : null}

          {resume ? (
            <FadeInView delay={40}>
              <ContinueCard
                name={resume.name}
                idx={resume.idx}
                total={resume.total}
                onPress={() => router.push(`/practice/${resume.id}`)}
              />
            </FadeInView>
          ) : null}

          <FadeInView delay={80}>
            <Pressable
              onPress={cycleGoal}
              style={styles.goalCard}
              testID="daily-goal-card"
              accessibilityRole="button"
              accessibilityLabel={`Өдрийн зорилго ${answeredToday} / ${goal}. Зорилго солих`}
            >
              <View style={[styles.goalIcon, { backgroundColor: goalDone ? colors.successSubtle : colors.brandTertiary }]}>
                <Ionicons name={goalDone ? "checkmark-done" : "flag"} size={22} color={goalDone ? colors.success : colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.goalTop}>
                  <Text style={styles.goalTitle}>Өдрийн зорилго</Text>
                  <Text style={[styles.goalCount, goalDone && { color: colors.success }]}>
                    {answeredToday}/{goal}
                  </Text>
                </View>
                <ProgressBar percent={goalPct} tone={goalDone ? "success" : "brand"} />
                <Text style={styles.goalHint}>
                  {goalDone ? "Өнөөдрийн зорилгодоо хүрлээ! 🎉" : "Зорилго солихдоо товшино уу"}
                </Text>
              </View>
            </Pressable>
          </FadeInView>

          <Text style={styles.sectionTitle}>Хурдан эхлэх</Text>
          <View style={styles.actionsGrid}>
            {[
              {
                testID: "action-practice",
                icon: "albums",
                title: "Бүлгээр давтах",
                subtitle: `${TOTAL_CATEGORIES} бүлэг`,
                color: colors.brandPrimary,
                onPress: () => router.push("/(tabs)/categories"),
              },
              {
                testID: "action-exam",
                icon: "school",
                title: "Шалгалт өгөх",
                subtitle: "20 асуулт · 25 мин",
                color: colors.success,
                onPress: () => router.push("/(tabs)/exam"),
              },
              {
                testID: "action-due",
                icon: "repeat",
                title: "Өнөөдрийн давталт",
                subtitle: dueCount > 0 ? `${dueCount} асуулт хүлээж байна` : "Бэлэн",
                color: colors.brand,
                badge: dueCount,
                onPress: () => router.push("/review/due"),
              },
              {
                testID: "action-wrong",
                icon: "refresh-circle",
                title: "Алдаатай асуулт",
                subtitle: isPro ? `${s.wrong || 0} асуулт` : "PRO",
                color: colors.warning,
                onPress: () => router.push("/review/wrong"),
              },
              {
                testID: "action-flashcard",
                icon: "albums",
                title: "Флашкарт",
                subtitle: "Замын тэмдэг цээжлэх",
                color: "#8B5CF6",
                onPress: () => router.push("/flashcard" as never),
              },
              {
                testID: "action-bookmark",
                icon: "bookmark",
                title: "Тэмдэглэсэн",
                subtitle: `${s.bookmarks || 0} асуулт`,
                color: colors.info,
                onPress: () => router.push("/review/bookmark"),
              },
            ].map((a, i) => (
              <FadeInView key={a.testID} delay={120 + i * 50} style={styles.actionSlot}>
                <ActionCard {...a} />
              </FadeInView>
            ))}
          </View>

          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>Сүүлийн шалгалтууд</Text>
            <Pressable onPress={() => router.push("/(tabs)/stats")} accessibilityRole="link" accessibilityLabel="Бүх статистик">
              <Text style={styles.link}>Бүгд</Text>
            </Pressable>
          </View>

          {(s.recentExams || []).length === 0 ? (
            <Card>
              <View style={styles.emptyExam}>
                <Ionicons name="clipboard-outline" size={28} color={colors.muted} />
                <Text style={styles.emptyExamText}>Одоогоор шалгалт өгөөгүй байна.</Text>
              </View>
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {(s.recentExams || []).slice(0, 3).map((e: any, i: number) => (
                <FadeInView key={e.attempt_id} delay={200 + i * 60}>
                  <ExamRow exam={e} onPress={() => router.push(`/attempt/${e.attempt_id}`)} />
                </FadeInView>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function ContinueCard({
  name,
  idx,
  total,
  onPress,
}: {
  name: string;
  idx: number;
  total: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const visual = categoryVisual(name);
  const pct = total ? Math.round((idx / total) * 100) : 0;

  return (
    <Pressable
      onPress={onPress}
      testID="continue-card"
      accessibilityRole="button"
      accessibilityLabel={`${categoryShortName(name)} бүлгийг ${idx + 1} дэх асуултаас үргэлжлүүлэх`}
      style={({ pressed }) => [styles.continueCard, pressed && { opacity: 0.94 }]}
    >
      <LinearGradient
        colors={[visual.color + "26", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.continueGlow}
      />
      <View style={[styles.continueIcon, { backgroundColor: visual.color + "22" }]}>
        <Ionicons name={visual.icon as any} size={24} color={visual.color} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.continueLabel}>Үргэлжлүүлэх</Text>
        <Text style={styles.continueName} numberOfLines={1}>{categoryShortName(name)}</Text>
        <ProgressBar percent={pct} height={6} shimmer={false} />
        <Text style={styles.continueSub}>
          {idx + 1}-р асуултаас · {total} асуултын {pct}%
        </Text>
      </View>
      <View style={[styles.continuePlay, { backgroundColor: colors.brandPrimary }]}>
        <Ionicons name="play" size={18} color={colors.onBrandPrimary} />
      </View>
    </Pressable>
  );
}

function ActionCard({ icon, title, subtitle, color, onPress, testID, badge }: any) {
  const styles = useStyles();
  const press = usePressScale(0.96);

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[styles.actionCard, press.style]}
    >
      <View style={styles.actionIconRow}>
        <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        {badge > 0 ? (
          <View style={[styles.actionBadge, { backgroundColor: color }]}>
            <Text style={styles.actionBadgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub}>{subtitle}</Text>
    </AnimatedPressable>
  );
}

function ExamRow({ exam, onPress }: { exam: any; onPress?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const passed = exam.passed;
  return (
    <Pressable
      onPress={onPress}
      testID={`home-attempt-${exam.attempt_id}`}
      accessibilityRole="button"
      accessibilityLabel={`Шалгалт ${exam.score} / ${exam.total}, ${exam.percent} хувь, ${passed ? "тэнцсэн" : "тэнцээгүй"}`}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
    >
      <Card style={styles.examRow}>
        <View style={[styles.examBadge, { backgroundColor: passed ? colors.successSubtle : colors.errorSubtle }]}>
          <Ionicons name={passed ? "checkmark" : "close"} size={20} color={passed ? colors.success : colors.error} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.examScore}>{exam.score}/{exam.total} зөв</Text>
          <Text style={styles.examDate}>{(exam.finishedAt || "").slice(0, 10)}</Text>
        </View>
        <Text style={[styles.examPct, { color: passed ? colors.success : colors.error }]}>{exam.percent}%</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  compact: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compactInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  compactName: { flex: 1, color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
  compactRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  compactStreak: { flexDirection: "row", alignItems: "center", gap: 3 },
  compactStreakText: { color: colors.warning, fontSize: type.sm, fontFamily: font.bold },
  compactPct: { color: colors.brandPrimary, fontSize: type.lg, fontFamily: font.extrabold },

  hero: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, gap: spacing.md },
  helloRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hello: { color: "rgba(255,255,255,0.85)", fontSize: type.base, fontFamily: font.medium },
  name: { color: "#FFFFFF", fontSize: type.title, fontFamily: font.extrabold, marginTop: 2 },

  weekRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: spacing.lg },
  weekItem: { flex: 1, alignItems: "center", gap: 5 },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  weekDotActive: { backgroundColor: "rgba(255,255,255,0.28)" },
  weekLabel: { color: "rgba(255,255,255,0.7)", fontSize: type.xs, fontFamily: font.medium },
  streakTotal: { alignItems: "center", paddingLeft: spacing.sm, minWidth: 40 },
  streakTotalValue: { color: "#FFFFFF", fontSize: type.xl, fontFamily: font.extrabold },
  streakTotalLabel: { color: "rgba(255,255,255,0.7)", fontSize: type.xs, fontFamily: font.medium },

  heroCard: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  heroCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroCardLabel: { color: "rgba(255,255,255,0.9)", fontSize: type.base, fontFamily: font.semibold },
  heroCardPct: { color: "#FFFFFF", fontSize: type.xl, fontFamily: font.extrabold },
  heroCardSub: { color: "rgba(255,255,255,0.8)", fontSize: type.sm, fontFamily: font.regular },

  body: { padding: spacing.gutter, gap: spacing.md },

  updateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.successSubtle,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  updateIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  updateTitle: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  updateSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular, marginTop: 2 },
  freezeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freezeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  freezeTitle: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  freezeSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular, marginTop: 2 },
  freezeAction: { color: colors.brandPrimary, fontSize: type.base, fontFamily: font.bold },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: "hidden",
  },
  continueGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  continueIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  continueLabel: { color: colors.brandPrimary, fontSize: type.xs, fontFamily: font.extrabold, letterSpacing: 0.6 },
  continueName: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  continueSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
  continuePlay: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },

  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.elev1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalTitle: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  goalCount: { color: colors.brandPrimary, fontSize: type.md, fontFamily: font.extrabold },
  goalHint: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },

  sectionTitle: { color: colors.onSurface, fontSize: type.xl, fontFamily: font.bold },
  sectionHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  link: { color: colors.brandPrimary, fontSize: type.base, fontFamily: font.semibold },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  actionSlot: { width: "47%", flexGrow: 1 },
  actionCard: {
    backgroundColor: colors.elev1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    minHeight: 116,
  },
  actionIconRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  actionBadge: { minWidth: 24, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, alignItems: "center" },
  actionBadgeText: { color: "#FFFFFF", fontSize: type.xs, fontFamily: font.extrabold },
  actionTitle: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  actionSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },

  examRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md + 2 },
  examBadge: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  examScore: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  examDate: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
  examPct: { fontSize: type.xl, fontFamily: font.extrabold },
  emptyExam: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  emptyExamText: { color: colors.muted, fontSize: type.base, fontFamily: font.regular },
}));
