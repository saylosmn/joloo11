import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProModal } from "@/src/components/ProModal";
import { ErrorState, LoadingView, ProgressBar } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { font, makeStyles, useTheme } from "@/src/theme";

export default function Categories() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [proOpen, setProOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories"),
  });

  const filtered = useMemo(() => {
    const list = (data as any[]) || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [data, query]);

  if (isLoading) return <LoadingView label="Бүлгүүд ачааллаж байна..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Бүлгүүд</Text>
        <Text style={styles.headerSub}>Бүлэг бүрээр дасгал хийж давт</Text>
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
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c: any) => c.category_id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.noResult}>
            <Ionicons name="search-outline" size={30} color={colors.muted} />
            <Text style={styles.noResultText}>«{query}» олдсонгүй</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`category-${item.category_id}`}
            onPress={() => {
              if (item.locked) setProOpen(true);
              else router.push(`/practice/${item.category_id}`);
            }}
            style={({ pressed }) => [styles.card, { opacity: item.locked ? 0.7 : pressed ? 0.92 : 1 }]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              {item.locked ? (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={14} color={colors.onWarningSubtle} />
                  <Text style={styles.lockText}>PRO</Text>
                </View>
              ) : (
                <Text style={styles.count}>{item.completed}/{item.questionCount}</Text>
              )}
            </View>
            {item.locked ? (
              <Text style={styles.lockedHint}>Нээхийн тулд PRO болно уу</Text>
            ) : (
              <>
                <ProgressBar percent={item.progressPercent} />
                <View style={styles.cardBottom}>
                  <Text style={styles.pct}>{item.progressPercent}% гүйцэтгэл</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
              </>
            )}
          </Pressable>
        )}
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

const useStyles = makeStyles((colors) => ({
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: colors.surface },
  headerTitle: { color: colors.onSurface, fontSize: 26, fontFamily: font.extrabold },
  headerSub: { color: colors.muted, fontSize: 14, marginTop: 2, fontFamily: font.regular },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
    backgroundColor: colors.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, height: 48,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.onSurface, fontFamily: font.medium, paddingVertical: 0 },
  noResult: { alignItems: "center", gap: 8, paddingVertical: 48 },
  noResultText: { color: colors.muted, fontSize: 14, fontFamily: font.medium },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardName: { flex: 1, color: colors.onSurface, fontSize: 15, fontFamily: font.bold, lineHeight: 21 },
  count: { color: colors.brandPrimary, fontSize: 14, fontFamily: font.bold },
  lockBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.warningSubtle, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  lockText: { color: colors.onWarningSubtle, fontSize: 11, fontFamily: font.bold },
  lockedHint: { color: colors.muted, fontSize: 13, fontFamily: font.medium },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pct: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
}));
