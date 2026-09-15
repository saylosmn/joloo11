import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, LoadingView, ProgressBar } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { DEFAULT_DAILY_GOAL, getDailyGoal, setDailyGoal } from "@/src/lib/progress-local";
import { font, makeStyles, useTheme } from "@/src/theme";

const TOTAL_QUESTIONS = 800;
const GOAL_STEPS = [10, 20, 30, 50];

export default function Home() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api.get("/stats") });
  const limits = useQuery({ queryKey: ["limits"], queryFn: () => api.get("/me/limits") });

  const [goal, setGoal] = useState(DEFAULT_DAILY_GOAL);
  useEffect(() => {
    getDailyGoal().then(setGoal);
  }, []);
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

  if (stats.isLoading || limits.isLoading) return <LoadingView label="Ачааллаж байна..." />;

  const s = stats.data || {};
  const overall = Math.round(((s.totalAnswered || 0) / TOTAL_QUESTIONS) * 100);
  const isPro = limits.data?.isPro;
  const streak = s.currentStreak || 0;
  const answeredToday = limits.data?.questionsAnswered ?? 0;
  const goalPct = goal ? Math.min(100, Math.round((answeredToday / goal) * 100)) : 0;
  const goalDone = answeredToday >= goal;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Сайн уу,</Text>
            <Text style={styles.name} testID="home-profile-name">{user?.profileName}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Badge label={isPro ? "PRO" : "FREE"} tone={isPro ? "success" : "muted"} icon={isPro ? "star" : "lock-closed"} />
            {streak > 0 ? (
              <View style={styles.streakChip} testID="home-streak">
                <Ionicons name="flame" size={14} color="#FDBA74" />
                <Text style={styles.streakChipText}>{streak} өдөр</Text>
              </View>
            ) : null}
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
      </LinearGradient>

      <View style={styles.body}>
        <Pressable onPress={cycleGoal} style={styles.goalCard} testID="daily-goal-card">
          <View style={[styles.goalIcon, { backgroundColor: goalDone ? colors.successSubtle : colors.brandTertiary }]}>
            <Ionicons name={goalDone ? "checkmark-done" : "flag"} size={22} color={goalDone ? colors.success : colors.brandPrimary} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.goalTop}>
              <Text style={styles.goalTitle}>Өдрийн зорилго</Text>
              <Text style={styles.goalCount}>{answeredToday}/{goal}</Text>
            </View>
            <ProgressBar percent={goalPct} />
            <Text style={styles.goalHint}>
              {goalDone ? "Өнөөдрийн зорилгодоо хүрлээ! 🎉" : "Зорилго солихдоо товшино уу"}
            </Text>
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>Хурдан эхлэх</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            testID="action-practice"
            icon="albums"
            title="Бүлгээр давтах"
            subtitle="33 бүлэг"
            color={colors.brandPrimary}
            onPress={() => router.push("/(tabs)/categories")}
          />
          <ActionCard
            testID="action-exam"
            icon="school"
            title="Шалгалт өгөх"
            subtitle="20 асуулт · 25 мин"
            color={colors.success}
            onPress={() => router.push("/(tabs)/exam")}
          />
          <ActionCard
            testID="action-wrong"
            icon="refresh-circle"
            title="Алдаатай асуулт"
            subtitle={isPro ? `${s.wrong || 0} асуулт` : "PRO"}
            color={colors.warning}
            onPress={() => router.push("/review/wrong")}
          />
          <ActionCard
            testID="action-bookmark"
            icon="bookmark"
            title="Тэмдэглэсэн"
            subtitle={`${s.bookmarks || 0} асуулт`}
            color={colors.info}
            onPress={() => router.push("/review/bookmark")}
          />
        </View>

        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>Сүүлийн шалгалтууд</Text>
          <Pressable onPress={() => router.push("/(tabs)/stats")}>
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
          <View style={{ gap: 10 }}>
            {(s.recentExams || []).slice(0, 3).map((e: any) => (
              <ExamRow key={e.attempt_id} exam={e} onPress={() => router.push(`/attempt/${e.attempt_id}`)} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ActionCard({ icon, title, subtitle, color, onPress, testID }: any) {
  const styles = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.9 }]}>
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub}>{subtitle}</Text>
    </Pressable>
  );
}

function ExamRow({ exam, onPress }: { exam: any; onPress?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const passed = exam.passed;
  return (
    <Pressable onPress={onPress} testID={`home-attempt-${exam.attempt_id}`} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
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
  hero: { paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  hello: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: font.medium },
  name: { color: "#FFFFFF", fontSize: 24, fontFamily: font.extrabold },
  heroCard: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 18, padding: 16, gap: 10 },
  heroCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroCardLabel: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontFamily: font.semibold },
  heroCardPct: { color: "#FFFFFF", fontSize: 20, fontFamily: font.extrabold },
  heroCardSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: font.regular },
  streakChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  streakChipText: { color: "#FFFFFF", fontSize: 12, fontFamily: font.bold },
  body: { padding: 20, gap: 14 },
  goalCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceSecondary, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  goalIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalTitle: { color: colors.onSurface, fontSize: 15, fontFamily: font.bold },
  goalCount: { color: colors.brandPrimary, fontSize: 15, fontFamily: font.extrabold },
  goalHint: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontFamily: font.bold },
  sectionHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  link: { color: colors.brandPrimary, fontSize: 14, fontFamily: font.semibold },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionTitle: { color: colors.onSurface, fontSize: 15, fontFamily: font.bold },
  actionSub: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  examRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  examBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  examScore: { color: colors.onSurface, fontSize: 15, fontFamily: font.bold },
  examDate: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  examPct: { fontSize: 18, fontFamily: font.extrabold },
  emptyExam: { alignItems: "center", gap: 8, paddingVertical: 12 },
  emptyExamText: { color: colors.muted, fontSize: 14, fontFamily: font.regular },
}));
