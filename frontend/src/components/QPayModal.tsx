import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { PrimaryButton } from "@/src/components/ui";
import { ApiError, api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { TOTAL_CATEGORIES } from "@/src/lib/content";
import { font, makeStyles, useTheme } from "@/src/theme";

type BankUrl = { name: string; description: string; logo: string; link: string };

type Payment = {
  payment_id: string;
  status: "NEW" | "PAID" | "CANCELED";
  amount: number;
  description?: string;
  qr_text?: string;
  qr_image?: string;
  short_url?: string;
  urls?: BankUrl[];
};

const POLL_MS = 3000;

/** Mounted only while the sheet is open, so every open starts from clean state. */
export function QPayModal({ onClose, onPaid }: { onClose: () => void; onPaid?: () => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { refreshUser } = useAuth();
  const [linkError, setLinkError] = useState<string | null>(null);

  const invoice = useQuery<Payment>({
    queryKey: ["qpay-invoice"],
    queryFn: () => api.post("/payments/create", { plan: "pro" }),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const payment = invoice.data;

  // Poll until QPay confirms the transfer. The server-side callback may settle it
  // first; either way the status endpoint is the single source of truth.
  const statusQuery = useQuery<Payment>({
    queryKey: ["qpay-status", payment?.payment_id],
    queryFn: () => api.get(`/payments/${payment!.payment_id}`),
    enabled: !!payment && payment.status !== "PAID",
    refetchInterval: (q) => (q.state.data?.status === "PAID" ? false : POLL_MS),
    retry: false,
  });

  const paid = (statusQuery.data?.status ?? payment?.status) === "PAID";

  const celebrated = useRef(false);
  useEffect(() => {
    if (!paid || celebrated.current) return;
    celebrated.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    refreshUser().finally(() => onPaid?.());
  }, [paid, refreshUser, onPaid]);

  const openLink = async (link: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Linking.openURL(link);
    } catch {
      setLinkError("Банкны апп нээгдсэнгүй. QR кодоор уншуулна уу.");
    }
  };

  const error =
    linkError ??
    (invoice.error
      ? invoice.error instanceof ApiError
        ? invoice.error.message
        : "Нэхэмжлэх үүсгэж чадсангүй"
      : null);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="qpay-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} testID="qpay-modal">
        <View style={styles.handle} />

        {paid ? (
          <View style={styles.center}>
            <View style={[styles.badge, { backgroundColor: colors.successSubtle }]}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            </View>
            <Text style={styles.title}>Төлбөр амжилттай!</Text>
            <Text style={styles.sub}>
              PRO эрх идэвхжлээ. Бүх {TOTAL_CATEGORIES} бүлэг нээгдлээ.
            </Text>
            <View style={styles.actions}>
              <PrimaryButton title="Эхлэх" onPress={onClose} testID="qpay-done" />
            </View>
          </View>
        ) : invoice.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
            <Text style={styles.sub}>Нэхэмжлэх үүсгэж байна…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <View style={[styles.badge, { backgroundColor: colors.errorSubtle }]}>
              <Ionicons name="alert-circle" size={44} color={colors.error} />
            </View>
            <Text style={styles.title}>Алдаа гарлаа</Text>
            <Text style={styles.sub}>{error}</Text>
            <View style={styles.actions}>
              <PrimaryButton
                title="Дахин оролдох"
                onPress={() => {
                  setLinkError(null);
                  invoice.refetch();
                }}
                testID="qpay-retry"
              />
            </View>
          </View>
        ) : payment ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>QPay-ээр төлөх</Text>
            <Text style={styles.amount}>{payment.amount.toLocaleString("en-US")}₮</Text>
            <Text style={styles.sub}>{payment.description}</Text>

            {payment.qr_image ? (
              <View style={styles.qrBox}>
                <Image
                  style={styles.qr}
                  source={{ uri: `data:image/png;base64,${payment.qr_image}` }}
                  contentFit="contain"
                  testID="qpay-qr"
                />
              </View>
            ) : null}

            <View style={styles.waitRow}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={styles.waitText}>Төлбөрийг хүлээж байна…</Text>
            </View>

            {payment.urls?.length ? (
              <>
                <Text style={styles.section}>Банкны аппаар төлөх</Text>
                <View style={styles.bankGrid}>
                  {payment.urls.map((b) => (
                    <Pressable
                      key={b.link}
                      style={styles.bank}
                      onPress={() => openLink(b.link)}
                      testID={`qpay-bank-${b.name}`}
                    >
                      <Image style={styles.bankLogo} source={{ uri: b.logo }} contentFit="contain" />
                      <Text style={styles.bankName} numberOfLines={2}>
                        {b.description || b.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {Platform.OS === "web" && payment.short_url ? (
              <View style={{ marginTop: 16 }}>
                <PrimaryButton
                  title="QPay холбоос нээх"
                  variant="secondary"
                  icon="open-outline"
                  onPress={() => openLink(payment.short_url as string)}
                  testID="qpay-short-url"
                />
              </View>
            ) : null}

            <View style={{ marginTop: 12 }}>
              <PrimaryButton title="Хаах" variant="secondary" onPress={onClose} testID="qpay-close" />
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: colors.overlay,
  },
  sheet: {
    marginTop: "auto",
    maxHeight: "88%",
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 16,
  },
  center: { alignItems: "center", paddingVertical: 24, gap: 6 },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { color: colors.onSurface, fontSize: 21, fontFamily: font.extrabold, textAlign: "center" },
  amount: {
    color: colors.brandPrimary,
    fontSize: 32,
    fontFamily: font.extrabold,
    textAlign: "center",
    marginTop: 4,
  },
  sub: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 6,
    fontFamily: font.regular,
  },
  actions: { marginTop: 18, alignSelf: "stretch" },
  qrBox: {
    marginTop: 18,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qr: { width: 220, height: 220 },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  waitText: { color: colors.onSurfaceSecondary, fontSize: 14, fontFamily: font.medium },
  section: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    fontFamily: font.bold,
    marginTop: 22,
    marginBottom: 10,
  },
  bankGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bank: {
    width: "31%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankLogo: { width: 36, height: 36, borderRadius: 8 },
  bankName: {
    color: colors.onSurfaceSecondary,
    fontSize: 11,
    fontFamily: font.medium,
    textAlign: "center",
  },
}));
