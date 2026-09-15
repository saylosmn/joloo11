import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProModal } from "@/src/components/ProModal";
import { Card, EmptyState, ErrorState, LoadingView, ProgressBar } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { font, makeStyles, useTheme } from "@/src/theme";

export default function Stats() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [proOpen, setProOpen] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get("/stats"),
  });
  const limits = useQuery({ queryKey: ["limits"], queryFn: () => api.get("/me/limits") });
  const isPro = limits.data?.isPro;

  if (isLoading) return <LoadingView label="Статистик ачааллаж байна..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const s = data;
  const activeCats = (s.perCategory || []).filter((c: any) => c.answered > 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Статистик</Text>

      {s.currentStreak > 0 ? (
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
      ) : null}

      <View style={styles.grid}>
        <Metric icon="checkbox-outline" color={colors.brandPrimary} value={s.totalAnswered} label="Хариулсан" />
        <Metric icon="trending-up" color={colors.success} value={`${s.correctPercent}%`} label="Зөв хувь" />
        <Metric icon="school-outline" color={colors.info} value={s.examsTaken} label="Шалгалт" />
        <Metric icon="ribbon-outline" color={colors.warning} value={s.examsPassed} label="Тэнцсэн" />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Бүлгийн гүйцэтгэл</Text>
        {!isPro ? <Ionicons name="lock-closed" size={16} color={colors.muted} /> : null}
      </View>

      {!isPro ? (
        <Pressable style={styles.lockCard} onPress={() => setProOpen(true)} testID="stats-pro-lock">
          <Ionicons name="stats-chart" size={28} color={colors.brandPrimary} />
          <Text style={styles.lockTitle}>Дэлгэрэнгүй статистик</Text>
          <Text style={styles.lockSub}>Бүлэг бүрийн гүйцэтгэлийг харахын тулд PRO болно уу.</Text>
        </Pressable>
      ) : activeCats.length === 0 ? (
        <Card><EmptyStateInline /></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {activeCats.map((c: any) => (
            <Card key={c.category_id} style={{ gap: 8 }}>
              <View style={styles.catHead}>
                <Text style={styles.catName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.catPct}>{c.percent}%</Text>
              </View>
              <ProgressBar percent={c.percent} />
              <Text style={styles.catSub}>{c.correct}/{c.questionCount} зөв</Text>
            </Card>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Сүүлийн 10 шалгалт</Text>
      {(s.recentExams || []).length === 0 ? (
        <Card><EmptyStateInline /></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {s.recentExams.map((e: any) => (
            <Pressable
              key={e.attempt_id}
              testID={`attempt-${e.attempt_id}`}
              onPress={() => router.push(`/attempt/${e.attempt_id}`)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <Card style={styles.examRow}>
                <View style={[styles.examDot, { backgroundColor: e.passed ? colors.success : colors.error }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.examScore}>{e.score}/{e.total} зөв</Text>
                  <Text style={styles.examDate} numberOfLines={1}>
                    {(e.finishedAt || "").slice(0, 10)}{e.category_name ? ` · ${e.category_name}` : ""}
                  </Text>
                </View>
                <Text style={[styles.examPct, { color: e.passed ? colors.success : colors.error }]}>{e.percent}%</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <ProModal visible={proOpen} onClose={() => setProOpen(false)} profileName={user?.profileName} reason="Дэлгэрэнгүй статистик зөвхөн PRO." />
    </ScrollView>
  );
}

function Metric({ icon, color, value, label }: any) {
  const styles = useStyles();
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyStateInline() {
  return <EmptyState icon="bar-chart-outline" title="Мэдээлэл алга" subtitle="Дасгал болон шалгалт хийж эхлээрэй." />;
}

const useStyles = makeStyles((colors) => ({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { color: colors.onSurface, fontSize: 26, fontFamily: font.extrabold, marginBottom: 16 },
  streakCard: {
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12,
    backgroundColor: colors.warningSubtle, borderRadius: 16, padding: 14,
  },
  streakIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  streakValue: { color: colors.onWarningSubtle, fontSize: 17, fontFamily: font.extrabold },
  streakSub: { color: colors.onWarningSubtle, fontSize: 12, fontFamily: font.medium, opacity: 0.8, marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  metric: {
    width: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  metricIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metricValue: { color: colors.onSurface, fontSize: 22, fontFamily: font.extrabold },
  metricLabel: { color: colors.muted, fontSize: 13, fontFamily: font.medium },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontFamily: font.bold },
  lockCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 18, padding: 24, alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  lockTitle: { color: colors.onSurface, fontSize: 16, fontFamily: font.bold },
  lockSub: { color: colors.muted, fontSize: 13, textAlign: "center", fontFamily: font.regular, lineHeight: 19 },
  catHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  catName: { flex: 1, color: colors.onSurface, fontSize: 14, fontFamily: font.semibold },
  catPct: { color: colors.brandPrimary, fontSize: 14, fontFamily: font.bold },
  catSub: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  examRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  examDot: { width: 10, height: 10, borderRadius: 999 },
  examScore: { color: colors.onSurface, fontSize: 15, fontFamily: font.bold },
  examDate: { color: colors.muted, fontSize: 12, fontFamily: font.regular },
  examPct: { fontSize: 18, fontFamily: font.extrabold },
}));
