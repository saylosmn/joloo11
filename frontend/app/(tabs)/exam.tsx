import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProModal } from "@/src/components/ProModal";
import { Badge, Card, PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { font, makeStyles, useTheme } from "@/src/theme";

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
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

      <Pressable style={styles.byCatBtn} onPress={() => setPickerOpen(true)} testID="by-category-exam-button">
        <View style={styles.byCatIcon}>
          <Ionicons name="albums" size={22} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.byCatTitle}>Бүлгээр шалгалт</Text>
          <Text style={styles.byCatSub}>Нэг бүлгээс л асуулт гаргана</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]} testID="category-exam-picker">
          <View style={styles.handle} />
          <Text style={styles.pickerTitle}>Бүлэг сонгох</Text>
          <FlatList
            data={cats.data || []}
            keyExtractor={(c: any) => c.category_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            renderItem={({ item }) => (
              <Pressable
                testID={`cat-exam-${item.category_id}`}
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
                <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                {item.locked ? (
                  <Ionicons name="lock-closed" size={16} color={colors.muted} />
                ) : (
                  <View style={styles.pickerRight}>
                    <Text style={styles.pickerCount}>{item.questionCount}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                )}
              </Pressable>
            )}
          />
        </View>
      </Modal>

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
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { color: colors.onSurface, fontSize: 26, fontFamily: font.extrabold },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 20, fontFamily: font.regular },
  heroIcon: {
    width: 84, height: 84, borderRadius: 26, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 24,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  ruleLabel: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 15, fontFamily: font.medium },
  ruleValue: { color: colors.onSurface, fontSize: 15, fontFamily: font.bold },
  resumeCard: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16,
    backgroundColor: colors.warningSubtle, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: colors.warning,
  },
  resumeIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  resumeTitle: { color: colors.onSurface, fontSize: 15, fontFamily: font.bold },
  resumeSub: { color: colors.onSurfaceSecondary, fontSize: 13, fontFamily: font.regular, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider },
  freeNote: { marginTop: 16, gap: 8, alignItems: "flex-start" },
  freeText: { color: colors.muted, fontSize: 13, fontFamily: font.regular },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  orText: { color: colors.muted, fontSize: 13, fontFamily: font.medium },
  byCatBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceSecondary, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  byCatIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  byCatTitle: { color: colors.onSurface, fontSize: 16, fontFamily: font.bold },
  byCatSub: { color: colors.muted, fontSize: 13, fontFamily: font.regular },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  pickerSheet: {
    marginTop: "auto", backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: "75%",
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 },
  pickerTitle: { color: colors.onSurface, fontSize: 18, fontFamily: font.bold, marginBottom: 8 },
  pickerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
    paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12,
  },
  pickerName: { flex: 1, color: colors.onSurface, fontSize: 15, fontFamily: font.medium },
  pickerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  pickerCount: { color: colors.brandPrimary, fontSize: 13, fontFamily: font.bold },
}));
