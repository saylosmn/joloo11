// A card that appears when a new JS bundle has been published, so a fix reaches
// people on the next launch instead of the one after it. Without it the update
// downloads quietly and only runs on the *following* cold start, which reads as
// "nothing changed" to anyone who just restarted the app.
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { font, radius, spacing, type, useElevation, useTheme } from "@/src/theme";

export function UpdateBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const elevation = useElevation(3);
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // `checkAutomatically` only runs on a cold start, so a session that stays open
  // would never learn about a publish. Ask again whenever the app comes back.
  useEffect(() => {
    if (!Updates.isEnabled) return;
    const check = () => {
      Updates.checkForUpdateAsync().catch(() => {
        // Offline, or the update server is unreachable — nothing to show.
      });
    };
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, []);

  const apply = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      // Pending means the bundle is already on the device; only fetch otherwise.
      if (!isUpdatePending) await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }, [isUpdatePending]);

  if (!Updates.isEnabled || dismissed) return null;
  if (!isUpdateAvailable && !isUpdatePending) return null;

  const working = busy || isDownloading;

  return (
    <Animated.View
      entering={FadeInUp.duration(260)}
      exiting={FadeOutUp.duration(180)}
      style={{
        // The strip spans the screen width; only the card itself takes taps.
        pointerEvents: "box-none",
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        // Floats over the top of whatever screen is showing rather than over the
        // tab bar, which would swallow taps meant for navigation.
        top: insets.top + spacing.sm,
      }}
    >
      <View
        testID="update-banner"
        accessibilityRole="alert"
        style={[
          elevation,
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            borderRadius: radius.lg,
            paddingVertical: spacing.md,
            paddingLeft: spacing.lg,
            paddingRight: spacing.md,
          },
        ]}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.md,
            backgroundColor: colors.brandTertiary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-down-circle" size={22} color={colors.onBrandTertiary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: type.base, fontFamily: font.bold }}>
            Шинэ хувилбар бэлэн
          </Text>
          <Text style={{ color: failed ? colors.error : colors.muted, fontSize: type.sm, fontFamily: font.regular, marginTop: 1 }}>
            {failed
              ? "Татаж чадсангүй. Дахин оролдоно уу."
              : working
                ? "Татаж байна..."
                : "Шинэчлэхэд апп дахин ачаална."}
          </Text>
        </View>

        <Pressable
          testID="update-apply"
          accessibilityRole="button"
          accessibilityLabel="Шинэ хувилбарыг татаж шинэчлэх"
          disabled={working}
          onPress={apply}
          style={({ pressed }) => ({
            minHeight: 38,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.md,
            backgroundColor: colors.brandPrimary,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed || working ? 0.75 : 1,
          })}
        >
          {working ? (
            <ActivityIndicator size="small" color={colors.onBrandPrimary} />
          ) : (
            <Text style={{ color: colors.onBrandPrimary, fontSize: type.base, fontFamily: font.bold }}>
              {failed ? "Дахин" : "Шинэчлэх"}
            </Text>
          )}
        </Pressable>

        <Pressable
          testID="update-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Хаах"
          disabled={working}
          hitSlop={8}
          onPress={() => setDismissed(true)}
          style={({ pressed }) => ({ padding: spacing.xs, opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
