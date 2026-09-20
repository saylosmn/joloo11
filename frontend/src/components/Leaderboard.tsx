// Weekly leaderboard among friends. Friendship is a one-way follow by profile
// name — the same name people already share to activate PRO — and only this
// week's activity is shown, never anyone's answers.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "@/src/components/AppText";
import { LeaderboardPodium } from "@/src/components/illustrations";
import { Sheet } from "@/src/components/Sheet";
import { Card, EmptyIllustration, PrimaryButton } from "@/src/components/ui";
import { ApiError, api } from "@/src/lib/api";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

type Entry = {
  user_id: string;
  profileName: string;
  isPro: boolean;
  isMe: boolean;
  weekAnswered: number;
  weekExams: number;
  activeDays: number;
  bestStreak: number;
  rank: number;
};

const MEDALS = ["#F59E0B", "#94A3B8", "#B45309"];

export function Leaderboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery<{ entries: Entry[]; days: number }>({
    queryKey: ["friends"],
    queryFn: () => api.get("/friends"),
  });

  const add = useMutation({
    mutationFn: (profileName: string) => api.post("/friends/add", { profileName }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["friends"] });
      setName("");
      setError(null);
      setAddOpen(false);
    },
    onError: (e: any) => {
      setError(e instanceof ApiError ? e.message : "Нэмэхэд алдаа гарлаа");
    },
  });

  const remove = useMutation({
    mutationFn: (profileName: string) => api.post("/friends/remove", { profileName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });

  const entries = data?.entries ?? [];
  const alone = entries.length <= 1;

  return (
    <Card style={{ gap: spacing.md }} testID="leaderboard">
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Долоо хоногийн тэмцээн</Text>
          <Text style={styles.sub}>Сүүлийн {data?.days ?? 7} хоногт хариулсан асуулт</Text>
        </View>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={styles.addBtn}
          testID="friend-add-open"
          accessibilityRole="button"
          accessibilityLabel="Найз нэмэх"
        >
          <Ionicons name="person-add" size={16} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {alone ? (
        <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm }}>
          <LeaderboardPodium size={140} />
          <Text style={styles.emptyText}>
            Найзынхаа профайл нэрийг нэмээд хэн илүү давтаж байгааг харьцуулаарай.
          </Text>
          <PrimaryButton
            title="Найз нэмэх"
            icon="person-add"
            variant="secondary"
            onPress={() => setAddOpen(true)}
            testID="friend-add-empty"
          />
        </View>
      ) : (
        entries.map((e) => (
          <View
            key={e.user_id}
            style={[styles.row, e.isMe && { backgroundColor: colors.brandTertiary }]}
            testID={`leaderboard-${e.rank}`}
            accessible
            accessibilityLabel={`${e.rank}-р байр, ${e.profileName}, ${e.weekAnswered} асуулт`}
          >
            <View
              style={[
                styles.rank,
                e.rank <= 3 ? { backgroundColor: MEDALS[e.rank - 1] } : { backgroundColor: colors.surfaceTertiary },
              ]}
            >
              <Text style={[styles.rankText, e.rank <= 3 && { color: "#FFFFFF" }]}>{e.rank}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, e.isMe && { color: colors.brandPrimary }]} numberOfLines={1}>
                  {e.profileName}
                  {e.isMe ? " (та)" : ""}
                </Text>
                {e.isPro ? <Ionicons name="star" size={12} color={colors.warning} /> : null}
              </View>
              <Text style={styles.meta}>
                {e.activeDays} өдөр идэвхтэй
                {e.weekExams > 0 ? ` · ${e.weekExams} шалгалт` : ""}
              </Text>
            </View>

            <Text style={styles.score}>{e.weekAnswered}</Text>

            {!e.isMe ? (
              <Pressable
                onPress={() => remove.mutate(e.profileName)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${e.profileName}-г хасах`}
                testID={`friend-remove-${e.profileName}`}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Найз нэмэх" testID="friend-sheet">
        <View style={{ gap: spacing.md }}>
          <Text style={styles.sheetHint}>
            Найзынхаа профайл нэрийг оруулна уу. Тэдний долоо хоногийн идэвх л харагдана.
          </Text>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            placeholder="profile_name"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            testID="friend-name-input"
            accessibilityLabel="Найзын профайл нэр"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            title="Нэмэх"
            icon="person-add"
            loading={add.isPending}
            disabled={name.trim().length < 3}
            onPress={() => add.mutate(name.trim())}
            testID="friend-add-submit"
          />
        </View>
      </Sheet>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
  sub: { color: colors.muted, fontSize: type.sm, fontFamily: font.regular, marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  rank: { width: 28, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  rankText: { color: colors.onSurfaceTertiary, fontSize: type.sm, fontFamily: font.extrabold },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { color: colors.onSurface, fontSize: type.base, fontFamily: font.bold, flexShrink: 1 },
  meta: { color: colors.muted, fontSize: type.xs, fontFamily: font.regular },
  score: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.extrabold, minWidth: 34, textAlign: "right" },
  emptyText: { color: colors.muted, fontSize: type.base, textAlign: "center", fontFamily: font.regular, lineHeight: 20 },
  sheetHint: { color: colors.muted, fontSize: type.base, lineHeight: 20, fontFamily: font.regular },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
    fontSize: type.md,
    fontFamily: font.medium,
  },
  error: { color: colors.error, fontSize: type.sm, fontFamily: font.medium },
}));
