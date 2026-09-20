import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { ProModal } from "@/src/components/ProModal";
import { Sheet } from "@/src/components/Sheet";
import { Badge, Card, PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { categoryShortName, categoryVisual } from "@/src/lib/category-visual";
import { useResponsive } from "@/src/lib/responsive";
import { useBottomTabBarHeight } from "@/src/lib/tab-bar";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

export default function ExamTab() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const limits = useQuery({ queryKey: ["limits"], queryFn: () => api.get("/me/limits") });
  // An exam left half-finished is still running on the server; offer it back.
  const active = useQuery<{ active: { remainingSeconds: number; category_name?: string | null } | null }>({
    queryKey: ["exam-active"],
    queryFn: () => api.get("/exam/active"),
    refetchOnWindowFocus: true,
  });
  const unfinished = active.data?.active ?? null;
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => api.get("/categories") });
  const isPro = limits.data?.isPro;
  const examsTaken = limits.data?.examsTaken ?? 0;
  const freeExhausted = !isPro && examsTaken >= (limits.data?.freeDailyExams ?? 1);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();
  const { contentWidthStyle } = useResponsive();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[
        styles.content,
        contentWidthStyle,
        { paddingTop: insets.top + spacing.lg, paddingBottom: tabBarHeight + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <OfflineBanner compact />
      <Text style={styles.title}>Шалгалт</Text>
      <Text style={styles.sub}>Жинхэнэ шалгалттай ижил нөхцөлд өөрийгөө сориорой.</Text>

      <View style={styles.heroIcon}>
        <Ionicons name="school" size={40} color={colors.brandPrimary} />
      </View>

      <Card style={{ gap: 14 }}>
        <Rule icon="help-circle-outline" label="Асуултын тоо" value="20 асуулт" />
        <View style={styles.divider} />
        <Rule icon="time-outline" label="Хугацаа" value="25 минут" />
        <View style={styles.divider} />
        <Rule icon="ribbon-outline" label="Тэнцэх босго" value="75% (15/20)" />
        <View style={styles.divider} />
        <Rule icon="eye-off-outline" label="Явцын хариу" value="Харагдахгүй" />
      </Card>

      {!isPro ? (
        <View style={styles.freeNote}>
          <Badge label={freeExhausted ? "Өнөөдрийн эрх дууссан" : `Өнөөдөр ${1 - examsTaken} эрх`} tone={freeExhausted ? "warning" : "muted"} icon="information-circle" />
          <Text style={styles.freeText}>Free хэрэглэгч өдөрт 1 шалгалт өгнө.</Text>
        </View>
      ) : null}

      {unfinished ? (
        <Pressable
          style={styles.resumeCard}
          onPress={() => router.push("/exam/session")}
          testID="resume-exam-card"
          accessibilityRole="button"
          accessibilityLabel={`Дуусаагүй шалгалт, ${Math.ceil(unfinished.remainingSeconds / 60)} минут үлдсэн. Үргэлжлүүлэх`}
        >
          <View style={styles.resumeIcon}>
            <Ionicons name="play-back" size={22} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resumeTitle}>Дуусаагүй шалгалт байна</Text>
            <Text style={styles.resumeSub}>
              {Math.ceil(unfinished.remainingSeconds / 60)} минут үлдсэн
              {unfinished.category_name ? ` · ${unfinished.category_name}` : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          testID="start-exam-button"
          title={unfinished ? "Үргэлжлүүлэх" : "Ерөнхий шалгалт эхлүүлэх"}
          icon="play"
          onPress={() => router.push("/exam/session")}
        />
      </View>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>эсвэл</Text>
        <View style={styles.orLine} />
      </View>

      <Text style={styles.modesTitle}>Богино горимууд</Text>
      <View style={styles.modesRow}>
        {[
          { key: "blitz", icon: "flash", title: "5 минутын блиц", sub: "10 асуулт · 5 мин", color: colors.warning },
          { key: "signs", icon: "trail-sign", title: "Замын тэмдэг", sub: "20 зурагтай асуулт", color: colors.info },
          { key: "weak", icon: "trending-down", title: "Сул талаа засах", sub: "15 асуулт", color: colors.error },
          { key: "marathon", icon: "infinite", title: "Марафон", sub: "100 асуулт", color: colors.success },
        ].map((m) => (
          <Pressable
            key={m.key}
            testID={`quick-${m.key}`}
            accessibilityRole="button"
            accessibilityLabel={`${m.title}. ${m.sub}`}
            // cast: expo-router regenerates typed routes on the next dev run
            onPress={() => router.push(`/quick/${m.key}` as never)}
            style={({ pressed }) => [styles.modeCard, pressed && { opacity: 0.92 }]}
          >
            <View style={[styles.modeIcon, { backgroundColor: m.color + "22" }]}>
              <Ionicons name={m.icon as any} size={20} color={m.color} />
            </View>
            <Text style={styles.modeTitle}>{m.title}</Text>
            <Text style={styles.modeSub}>{m.sub}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.byCatBtn}
        onPress={() => setPickerOpen(true)}
        testID="by-category-exam-button"
        accessibilityRole="button"
        accessibilityLabel="Бүлгээр шалгалт өгөх — бүлэг сонгох"
      >
        <View style={styles.byCatIcon}>
          <Ionicons name="albums" size={22} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.byCatTitle}>Бүлгээр шалгалт</Text>
          <Text style={styles.byCatSub}>Нэг бүлгээс л асуулт гаргана</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Бүлэг сонгох"
        snapPoints={["75%"]}
        testID="category-exam-picker"
      >
        {(cats.data || []).map((item: any) => {
          const visual = categoryVisual(item.name);
          return (
            <Pressable
              key={item.category_id}
              testID={`cat-exam-${item.category_id}`}
              accessibilityRole="button"
              accessibilityLabel={
                item.locked
                  ? `${categoryShortName(item.name)} — PRO шаардлагатай`
                  : `${categoryShortName(item.name)}, ${item.questionCount} асуулт`
              }
              style={({ pressed }) => [styles.pickerRow, pressed && { backgroundColor: colors.surfaceTertiary }]}
              onPress={() => {
                if (item.locked) {
                  setPickerOpen(false);
                  setProOpen(true);
                  return;
                }
                setPickerOpen(false);
                router.push(`/exam/session?categoryId=${item.category_id}`);
              }}
            >
              <View style={[styles.pickerIcon, { backgroundColor: visual.color + "22" }]}>
                <Ionicons name={visual.icon as any} size={16} color={visual.color} />
              </View>
              <Text style={styles.pickerName} numberOfLines={1}>{categoryShortName(item.name)}</Text>
              {item.locked ? (
                <Ionicons name="lock-closed" size={16} color={colors.muted} />
              ) : (
                <View style={styles.pickerRight}>
                  <Text style={styles.pickerCount}>{item.questionCount}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </View>
              )}
            </Pressable>
          );
        })}
      </Sheet>

      <ProModal visible={proOpen} onClose={() => setProOpen(false)} profileName={user?.profileName} reason="Энэ бүлэг зөвхөн PRO хэрэглэгчдэд нээлттэй." />
    </ScrollView>
  );
}

function Rule({ icon, label, value }: { icon: any; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.ruleRow}>
      <View style={styles.ruleIcon}>
        <Ionicons name={icon} size={20} color={colors.brandPrimary} />
      </View>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text style={styles.ruleValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  title: { color: colors.onSurface, fontSize: type.title, fontFamily: font.extrabold },
  sub: { color: colors.muted, fontSize: type.base, marginTop: 4, marginBottom: spacing.xl, fontFamily: font.regular },
  heroIcon: {
    width: 84, height: 84, borderRadius: radius.xl, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.xl,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  ruleIcon: {
    width: 38, height: 38, borderRadius: radius.sm + 4, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  ruleLabel: { flex: 1, color: colors.onSurfaceSecondary, fontSize: type.md, fontFamily: font.medium },
  ruleValue: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  resumeCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg,
    backgroundColor: colors.warningSubtle, borderRadius: radius.lg, padding: spacing.md + 2,
    borderWidth: 1, borderColor: colors.warning,
  },
  resumeIcon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  resumeTitle: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold },
  resumeSub: { color: colors.onSurfaceSecondary, fontSize: type.sm, fontFamily: font.regular, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider },
  freeNote: { marginTop: spacing.lg, gap: spacing.sm, alignItems: "flex-start" },
  freeText: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.lg + 2 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  orText: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  byCatBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.elev1, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  byCatIcon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  byCatTitle: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
  byCatSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
  modesTitle: { color: colors.onSurface, fontSize: type.xl, fontFamily: font.bold, marginTop: spacing.xl, marginBottom: spacing.md },
  modesRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  modeCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.elev1,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  modeIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  modeTitle: { color: colors.onSurface, fontSize: type.base, fontFamily: font.bold },
  modeSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
  pickerRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.md,
  },
  pickerIcon: { width: 32, height: 32, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center" },
  pickerName: { flex: 1, color: colors.onSurface, fontSize: type.md, fontFamily: font.medium },
  pickerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  pickerCount: { color: colors.brandPrimary, fontSize: type.sm, fontFamily: font.bold },
}));
