// Redeeming a promo code. Driving schools buy a batch of days and hand the code
// to their students; this is where a student types it in.
import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "@/src/components/AppText";
import { PrimaryButton } from "@/src/components/ui";
import { ApiError, api } from "@/src/lib/api";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

export function PromoCodeBox({ onRedeemed }: { onRedeemed?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okDays, setOkDays] = useState<number | null>(null);

  const redeem = useMutation({
    mutationFn: () => api.post<{ days: number }>("/promo/redeem", { code: code.trim() }),
    onSuccess: (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOkDays(res.days);
      setError(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["limits"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onRedeemed?.();
    },
    onError: (e: any) => {
      setOkDays(null);
      setError(e instanceof ApiError ? e.message : "Код идэвхжсэнгүй");
    },
  });

  if (okDays != null) {
    return (
      <View style={[styles.box, { backgroundColor: colors.successSubtle }]} testID="promo-success">
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={[styles.successText, { color: colors.onSuccessSubtle }]}>
          {okDays} хоногийн PRO идэвхжлээ 🎉
        </Text>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.toggle}
        testID="promo-open"
        accessibilityRole="button"
        accessibilityLabel="Урамшууллын код оруулах"
      >
        <Ionicons name="ticket-outline" size={16} color={colors.brandPrimary} />
        <Text style={styles.toggleText}>Урамшууллын код байна уу?</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <View style={styles.inputRow}>
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setError(null);
          }}
          placeholder="ЖИШЭЭ: A1B2C3D4"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={16}
          style={styles.input}
          testID="promo-input"
          accessibilityLabel="Урамшууллын код"
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        title="Идэвхжүүлэх"
        icon="ticket-outline"
        variant="secondary"
        disabled={code.trim().length < 4}
        loading={redeem.isPending}
        onPress={() => redeem.mutate()}
        testID="promo-submit"
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  toggleText: { color: colors.brandPrimary, fontSize: type.base, fontFamily: font.semibold },
  inputRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
    fontSize: type.lg,
    fontFamily: font.bold,
    letterSpacing: 2,
    textAlign: "center",
  },
  error: { color: colors.error, fontSize: type.sm, fontFamily: font.medium, textAlign: "center" },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  successText: { flex: 1, fontSize: type.base, fontFamily: font.bold },
}));
