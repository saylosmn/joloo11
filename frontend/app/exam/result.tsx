import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { AttemptReview } from "@/src/components/AttemptReview";
import { ErrorState, LoadingView, PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { getExamResult, type ExamResult } from "@/src/lib/examStore";
import { font, useTheme } from "@/src/theme";

export default function ExamResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { attemptId } = useLocalSearchParams<{ attemptId?: string }>();

  // The just-finished attempt is handed over in memory; after a reload or a cold
  // start that is gone, so fall back to fetching it by id.
  const handedOver = getExamResult();
  const id = attemptId ?? handedOver?.attempt_id;
  const needsFetch = !handedOver && !!id;

  const fetched = useQuery<ExamResult>({
    queryKey: ["attempt", id],
    queryFn: () => api.get(`/attempts/${id}`),
    enabled: needsFetch,
  });

  const result = handedOver ?? fetched.data;

  // A short celebratory / consoling tap the moment the score lands.
  useEffect(() => {
    if (!result) return;
    Haptics.notificationAsync(
      result.passed
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
  }, [result]);

  if (needsFetch && fetched.isPending) return <LoadingView />;

  if (!result) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {fetched.isError ? (
          <ErrorState message="Дүнг татаж чадсангүй." onRetry={fetched.refetch} />
        ) : (
          <Text style={{ color: colors.muted, fontFamily: font.regular }}>Дүн олдсонгүй.</Text>
        )}
        <View style={{ marginTop: 16 }}>
          <PrimaryButton title="Нүүр рүү" onPress={() => router.replace("/(tabs)")} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <AttemptReview
        data={result}
        celebrate
        footer={
          <View style={{ gap: 10, marginTop: 20 }}>
            <PrimaryButton
              testID="result-retry"
              title="Дахин шалгалт өгөх"
              onPress={() => router.replace("/exam/session")}
            />
            <PrimaryButton
              title="Нүүр рүү буцах"
              variant="secondary"
              onPress={() => router.replace("/(tabs)")}
            />
          </View>
        }
      />
    </ScrollView>
  );
}
