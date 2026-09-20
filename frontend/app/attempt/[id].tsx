// Past-attempt detail — opened from Home / Stats history. Fetches the full
// attempt (with per-question detail) and renders the shared review UI.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { AttemptReview, type AttemptLike } from "@/src/components/AttemptReview";
import { ListSkeleton } from "@/src/components/Skeleton";
import { ErrorState, PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { font, makeStyles, useTheme } from "@/src/theme";

export default function AttemptDetailScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, refetch } = useQuery<AttemptLike>({
    queryKey: ["attempt", id],
    queryFn: () => api.get(`/attempts/${id}`),
  });

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        testID="attempt-back"
        onPress={() => router.back()}
        hitSlop={10}
        style={styles.hBtn}
        accessibilityRole="button"
        accessibilityLabel="Буцах"
      >
        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.hTitle}>Шалгалтын дүн</Text>
      <View style={styles.hBtn} />
    </View>
  );

  if (isLoading)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <ListSkeleton rows={4} header={false} rowHeight={110} />
      </View>
    );
  if (!data)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <ErrorState onRetry={refetch} message="Шалгалтын дэлгэрэнгүй олдсонгүй." />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {Header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <AttemptReview
          data={data}
          heroTopPadding={20}
          footer={
            <View style={{ marginTop: 20 }}>
              <PrimaryButton title="Буцах" variant="secondary" onPress={() => router.back()} />
            </View>
          }
        />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.surfaceSecondary,
  },
  hBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { flex: 1, textAlign: "center", color: colors.onSurface, fontSize: 16, fontFamily: font.bold },
}));
