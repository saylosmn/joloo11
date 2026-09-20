// A thin strip that appears when the backend is unreachable. It also shows how
// many answers are waiting to be uploaded, so nobody wonders whether their work
// was lost.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { Text } from "@/src/components/AppText";
import { useOnlineStatus } from "@/src/lib/offline";
import { pendingAnswerCount } from "@/src/lib/offline-queue";
import { font, radius, spacing, type, useTheme } from "@/src/theme";

export function OfflineBanner({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const read = () => {
      pendingAnswerCount()
        .then((n) => alive && setPending(n))
        .catch(() => {});
    };
    read();
    const timer = setInterval(read, 4000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") read();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [online]);

  if (online && pending === 0) return null;

  const syncing = online && pending > 0;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(160)}
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: compact ? 5 : 8,
        backgroundColor: syncing ? colors.brandTertiary : colors.warningSubtle,
      }}
      testID="offline-banner"
    >
      <Ionicons
        name={syncing ? "cloud-upload-outline" : "cloud-offline-outline"}
        size={14}
        color={syncing ? colors.onBrandTertiary : colors.onWarningSubtle}
      />
      <Text
        numberOfLines={1}
        style={{
          color: syncing ? colors.onBrandTertiary : colors.onWarningSubtle,
          fontSize: type.sm,
          fontFamily: font.semibold,
        }}
      >
        {syncing
          ? `${pending} хариулт илгээгдэж байна...`
          : pending > 0
            ? `Офлайн — ${pending} хариулт хадгалагдсан`
            : "Офлайн горим — хадгалсан асуултууд ажиллана"}
      </Text>
    </Animated.View>
  );
}

/** Rounded variant for screens that need it inside their content. */
export function OfflineChip() {
  const { colors } = useTheme();
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: colors.warningSubtle,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={13} color={colors.onWarningSubtle} />
      <Text style={{ color: colors.onWarningSubtle, fontSize: type.xs, fontFamily: font.bold }}>
        Офлайн
      </Text>
    </View>
  );
}
