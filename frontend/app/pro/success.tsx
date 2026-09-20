// The moment after paying. Previously a modal simply closed and the user was
// left to guess whether it worked; now the app says so clearly, shows what just
// opened up, and points at the first thing worth doing.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { Confetti } from "@/src/components/Confetti";
import { PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { TOTAL_CATEGORIES, TOTAL_QUESTIONS } from "@/src/lib/content";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

type Via = "paid" | "trial" | "promo";

const COPY: Record<Via, { title: string; sub: string }> = {
  paid: { title: "PRO боллоо! 🎉", sub: "Төлбөр амжилттай баталгаажлаа." },
  trial: { title: "Туршилт эхэллээ 🎉", sub: "PRO-гийн бүх боломж түр хугацаанд нээлттэй." },
  promo: { title: "Код идэвхжлээ 🎉", sub: "PRO-гийн бүх боломж нээгдлээ." },
};

export default function ProSuccess() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { via } = useLocalSearchParams<{ via?: string }>();

  const kind: Via = via === "trial" || via === "promo" ? via : "paid";
  const copy = COPY[kind];

  const limits = useQuery<{ isPro: boolean; proExpiresAt?: string | null }>({
    queryKey: ["limits"],
    queryFn: () => api.get("/me/limits"),
  });

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Everything gated on PRO should re-read now, not on the next app start.
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["limits"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }, [qc]);

  const expires = limits.data?.proExpiresAt?.slice(0, 10);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Confetti active height={480} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.crown}
        >
          <Ionicons name="star" size={46} color="#FFFFFF" />
        </LinearGradient>

        <Text style={styles.title} testID="pro-success-title">{copy.title}</Text>
        <Text style={styles.sub}>{copy.sub}</Text>
        {expires ? <Text style={styles.expiry}>Хүчинтэй: {expires} хүртэл</Text> : null}

        <View style={styles.list}>
          <Unlocked icon="albums" title={`Бүх ${TOTAL_CATEGORIES} бүлэг`} sub={`${TOTAL_QUESTIONS} асуулт бүрэн нээлттэй`} />
          <Unlocked icon="infinite" title="Хязгааргүй дасгал" sub="Өдрийн 30 асуултын хязгаар алга" />
          <Unlocked icon="school" title="Хязгааргүй шалгалт" sub="Өдөрт хэдэн ч удаа өгч болно" />
          <Unlocked icon="repeat" title="Давталтын бүрэн жагсаалт" sub="Алдаатай асуулт, SRS хязгааргүй" />
          <Unlocked icon="stats-chart" title="Дэлгэрэнгүй статистик" sub="Бүлэг бүрийн гүйцэтгэл, сул талууд" />
          <Unlocked icon="color-palette" title="Үндсэн өнгө сонгох" sub="Профайлаас солино" />
        </View>

        <View style={{ alignSelf: "stretch", gap: spacing.md, marginTop: spacing.lg }}>
          <PrimaryButton
            title="Түгжээтэй байсан бүлгүүд рүү"
            icon="albums"
            testID="pro-success-categories"
            onPress={() => router.replace("/(tabs)/categories")}
          />
          <PrimaryButton
            title="Нүүр рүү"
            variant="secondary"
            testID="pro-success-home"
            onPress={() => router.replace("/(tabs)")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Unlocked({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon as any} size={18} color={colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  content: { paddingHorizontal: spacing.gutter, alignItems: "center" },
  crown: {
    width: 108,
    height: 108,
    borderRadius: radius.xxl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { color: colors.onSurface, fontSize: type.title, fontFamily: font.extrabold, textAlign: "center" },
  sub: {
    color: colors.muted,
    fontSize: type.md,
    fontFamily: font.regular,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  expiry: { color: colors.brandPrimary, fontSize: type.base, fontFamily: font.bold, marginTop: spacing.sm },
  list: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.elev1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.successSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: colors.onSurface, fontSize: type.base, fontFamily: font.bold },
  rowSub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular },
}));
