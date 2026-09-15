import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { font, makeStyles, useTheme } from "@/src/theme";

export function Icon({
  name,
  size = 22,
  color,
}: {
  name: any;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.onSurface} />;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  icon,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: any;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "danger"
        ? colors.errorSubtle
        : colors.surfaceTertiary;
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "danger"
        ? colors.onErrorSubtle
        : colors.onSurfaceTertiary;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const styles = useStyles();
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${p}%` }]} />
    </View>
  );
}

export function Badge({
  label,
  tone = "brand",
  icon,
}: {
  label: string;
  tone?: "brand" | "success" | "muted" | "warning";
  icon?: any;
}) {
  const { colors } = useTheme();
  const map = {
    brand: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
    success: { bg: colors.successSubtle, fg: colors.onSuccessSubtle },
    muted: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    warning: { bg: colors.warningSubtle, fg: colors.onWarningSubtle },
  } as const;
  const c = map[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: c.bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontSize: 12, fontFamily: font.bold }}>{label}</Text>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function LoadingView({ label }: { label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="loading-view">
      <ActivityIndicator size="large" color={colors.brandPrimary} />
      {label ? <Text style={styles.centerText}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon = "documents-outline",
  title,
  subtitle,
}: {
  icon?: any;
  title: string;
  subtitle?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="empty-state">
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.centerText}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="error-state">
      <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
      <Text style={styles.emptyTitle}>Алдаа гарлаа</Text>
      <Text style={styles.centerText}>{message || "Дахин оролдоно уу."}</Text>
      {onRetry ? (
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title="Дахин оролдох" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { fontSize: 16, fontFamily: font.bold },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  centerText: { color: colors.muted, fontSize: 14, textAlign: "center", fontFamily: font.regular, lineHeight: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { color: colors.onSurface, fontSize: 17, fontFamily: font.bold },
}));
