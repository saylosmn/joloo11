import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { CategoryPreviewSheet } from "@/src/components/CategoryPreviewSheet";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { ProgressRing } from "@/src/components/ProgressRing";
import { ProModal } from "@/src/components/ProModal";
import { ListSkeleton } from "@/src/components/Skeleton";
import { EmptyIllustration, ErrorState } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { categoryGroup, categoryShortName, categoryVisual } from "@/src/lib/category-visual";
import { useResponsive } from "@/src/lib/responsive";
import { useBottomTabBarHeight } from "@/src/lib/tab-bar";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

type Cat = {
  category_id: string;
  name: string;
  questionCount: number;
  completed: number;
  progressPercent: number;
  locked?: boolean;
};

type Filter = "all" | "started" | "untouched" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "started", label: "Эхэлсэн" },
  { key: "untouched", label: "Эхлээгүй" },
  { key: "done", label: "Дууссан" },
];

export default function Categories() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [proOpen, setProOpen] = useState(false);
  // Tapping a locked chapter shows one real question before the upsell.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const tabBarHeight = useBottomTabBarHeight();
  const { contentWidthStyle } = useResponsive();

  const { data, isLoading, isError, refetch } = useQuery<Cat[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories"),
  });

  const list = useMemo(() => (data as Cat[]) || [], [data]);

  const counts = useMemo(() => {
    const started = list.filter((c) => c.progressPercent > 0 && c.progressPercent < 100).length;
    const untouched = list.filter((c) => c.progressPercent === 0).length;
    const done = list.filter((c) => c.progressPercent >= 100).length;
    return { all: list.length, started, untouched, done };
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (filter === "started") return c.progressPercent > 0 && c.progressPercent < 100;
      if (filter === "untouched") return c.progressPercent === 0;
      if (filter === "done") return c.progressPercent >= 100;
      return true;
    });
  }, [list, query, filter]);

  if (isLoading) return <ListSkeleton topInset={insets.top} rows={7} rowHeight={78} />;
  if (isError && !data) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, contentWidthStyle, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Бүлгүүд</Text>
            <Text style={styles.headerSub}>Бүлэг бүрээр дасгал хийж давт</Text>
          </View>
          <View style={styles.doneChip}>
            <Ionicons name="trophy" size={13} color={colors.warning} />
            <Text style={styles.doneChipText}>{counts.done}/{counts.all}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="category-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Бүлэг хайх..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            accessibilityLabel="Бүлэг хайх"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Хайлтыг цэвэрлэх">
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key];
            return (
              <Pressable
                key={f.key}
                testID={`filter-${f.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${f.label}, ${n} бүлэг`}
                onPress={() => {
                  setFilter(f.key);
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={[styles.chip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              >
                <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>
                  {f.label}
                </Text>
                <View style={[styles.chipCount, active && { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                  <Text style={[styles.chipCountText, active && { color: colors.onBrandPrimary }]}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <OfflineBanner compact />

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.category_id}
        contentContainerStyle={[styles.list, contentWidthStyle, { paddingBottom: tabBarHeight + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.noResult}>
            <EmptyIllustration icon="search-outline" tone="brand" size={110} />
            <Text style={styles.noResultText}>
              {query ? `«${query}» олдсонгүй` : "Энэ шүүлтэд тохирох бүлэг алга"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CategoryRow
            item={item}
            onPress={() => {
              if (item.locked) {
                Haptics.selectionAsync().catch(() => {});
                setPreviewId(item.category_id);
              } else {
                router.push(`/practice/${item.category_id}`);
              }
            }}
          />
        )}
      />

      <CategoryPreviewSheet
        categoryId={previewId}
        visible={!!previewId}
        onClose={() => setPreviewId(null)}
        onUpgrade={() => {
          setPreviewId(null);
          setProOpen(true);
        }}
      />

      <ProModal
        visible={proOpen}
        onClose={() => setProOpen(false)}
        profileName={user?.profileName}
        reason="Энэ бүлэг зөвхөн PRO хэрэглэгчдэд нээлттэй."
      />
    </View>
  );
}

function CategoryRow({ item, onPress }: { item: Cat; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const visual = categoryVisual(item.name);
  const mastered = !item.locked && item.progressPercent >= 100;
  const group = categoryGroup(item.name);
  const gold = "#F59E0B";

  return (
    <Pressable
      testID={`category-${item.category_id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        item.locked
          ? `${categoryShortName(item.name)} — PRO шаардлагатай`
          : `${categoryShortName(item.name)}, ${item.completed} / ${item.questionCount} асуулт, ${item.progressPercent} хувь`
      }
      style={({ pressed }) => [
        styles.card,
        mastered && { borderColor: gold + "77" },
        { opacity: item.locked ? 0.75 : pressed ? 0.93 : 1 },
      ]}
    >
      <View style={styles.ringWrap}>
        {item.locked ? (
          <View style={[styles.lockRing, { borderColor: colors.border }]}>
            <Ionicons name="lock-closed" size={18} color={colors.muted} />
          </View>
        ) : (
          <ProgressRing
            size={48}
            stroke={4}
            percent={item.progressPercent}
            color={mastered ? gold : visual.color}
            trackColor={colors.surfaceTertiary}
          >
            <Ionicons
              name={(mastered ? "trophy" : visual.icon) as any}
              size={20}
              color={mastered ? gold : visual.color}
            />
          </ProgressRing>
        )}
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        {group ? <Text style={styles.group}>{group}</Text> : null}
        <Text style={styles.cardName} numberOfLines={2}>{categoryShortName(item.name)}</Text>
        {item.locked ? (
          <Text style={styles.lockedHint}>Нээхийн тулд PRO болно уу</Text>
        ) : (
          <Text style={styles.cardMeta}>
            {item.completed}/{item.questionCount} асуулт
            <Text style={{ color: mastered ? gold : colors.muted }}>
              {"  ·  "}
              {item.progressPercent}%
            </Text>
          </Text>
        )}
      </View>

      {item.locked ? (
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={12} color={colors.onWarningSubtle} />
          <Text style={styles.lockText}>PRO</Text>
        </View>
      ) : mastered ? (
        <View style={[styles.masterBadge, { backgroundColor: gold + "22" }]}>
          <Ionicons name="checkmark-circle" size={13} color={gold} />
          <Text style={[styles.masterText, { color: gold }]}>Эзэмшсэн</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.md, backgroundColor: colors.surface },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  headerTitle: { color: colors.onSurface, fontSize: type.title, fontFamily: font.extrabold },
  headerSub: { color: colors.muted, fontSize: type.base, marginTop: 2, fontFamily: font.regular },
  doneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.warningSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  doneChipText: { color: colors.onWarningSubtle, fontSize: type.sm, fontFamily: font.bold },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.elev1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 2,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: type.md, color: colors.onSurface, fontFamily: font.medium, paddingVertical: 0 },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elev1,
  },
  chipText: { color: colors.onSurfaceTertiary, fontSize: type.sm, fontFamily: font.bold },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
  },
  chipCountText: { color: colors.muted, fontSize: type.xs, fontFamily: font.bold },

  noResult: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl },
  noResultText: { color: colors.muted, fontSize: type.base, fontFamily: font.medium },
  list: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.elev1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ringWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  lockRing: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  group: { color: colors.muted, fontSize: type.xs, fontFamily: font.bold, letterSpacing: 0.4 },
  cardName: { color: colors.onSurface, fontSize: type.md, fontFamily: font.bold, lineHeight: 20 },
  cardMeta: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  lockedHint: { color: colors.muted, fontSize: type.sm, fontFamily: font.medium },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warningSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  lockText: { color: colors.onWarningSubtle, fontSize: type.xs, fontFamily: font.bold },
  masterBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  masterText: { fontSize: type.xs, fontFamily: font.bold },
}));
