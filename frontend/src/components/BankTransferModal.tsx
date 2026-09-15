import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/src/components/ui";
import { ApiError, api, imageUrl } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { TOTAL_CATEGORIES } from "@/src/lib/content";
import { font, makeStyles, useTheme } from "@/src/theme";

type BankInfo = {
  enabled: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  qrUrl?: string | null;
};

type Request = {
  payment_id: string;
  ref: string;
  status: "NEW" | "PENDING" | "PAID" | "REJECTED";
  amount: number;
  bank?: BankInfo;
};

const POLL_MS = 4000;

/** Mounted only while the sheet is open, so every open starts from clean state. */
export function BankTransferModal({
  onClose,
  onPaid,
}: {
  onClose: () => void;
  onPaid?: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { refreshUser } = useAuth();
  const qc = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);

  const request = useQuery<Request>({
    queryKey: ["bank-request"],
    queryFn: () => api.post("/payments/bank/create"),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const req = request.data;
  const bank = req?.bank ?? null;

  // Once the user says they transferred, wait for the admin to confirm in Telegram.
  const statusQuery = useQuery<Request>({
    queryKey: ["bank-status", req?.payment_id],
    queryFn: () => api.get(`/payments/${req!.payment_id}`),
    enabled: !!req && req.status === "PENDING",
    refetchInterval: (q) =>
      q.state.data && q.state.data.status !== "PENDING" ? false : POLL_MS,
    retry: false,
  });

  const status: Request["status"] = statusQuery.data?.status ?? req?.status ?? "NEW";
  const paid = status === "PAID";

  const celebrated = useRef(false);
  useEffect(() => {
    if (!paid || celebrated.current) return;
    celebrated.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    refreshUser().finally(() => onPaid?.());
  }, [paid, refreshUser, onPaid]);

  const claim = useMutation({
    mutationFn: () => api.post<Request>(`/payments/bank/${req!.payment_id}/claim`),
    onSuccess: (updated) => {
      // Feed the answer straight into both caches so polling picks up from here.
      qc.setQueryData(["bank-request"], (prev?: Request) =>
        prev ? { ...prev, status: updated.status } : prev,
      );
      qc.setQueryData(["bank-status", req?.payment_id], updated);
    },
  });

  const copy = async (value: string, tag: string) => {
    await Clipboard.setStringAsync(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCopied(tag);
    setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1600);
  };

  const failure = request.error ?? claim.error;
  const error = failure
    ? failure instanceof ApiError
      ? failure.message
      : "Хүсэлт үүсгэж чадсангүй"
    : null;

  const retry = () => {
    claim.reset();
    celebrated.current = false;
    request.refetch();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="bank-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} testID="bank-modal">
        <View style={styles.handle} />

        {paid ? (
          <View style={styles.center}>
            <View style={[styles.badge, { backgroundColor: colors.successSubtle }]}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            </View>
            <Text style={styles.title}>Баталгаажлаа!</Text>
            <Text style={styles.sub}>
              PRO эрх идэвхжлээ. Бүх {TOTAL_CATEGORIES} бүлэг нээгдлээ.
            </Text>
            <View style={styles.actions}>
              <PrimaryButton title="Эхлэх" onPress={onClose} testID="bank-done" />
            </View>
          </View>
        ) : request.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
            <Text style={styles.sub}>Бэлдэж байна…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <View style={[styles.badge, { backgroundColor: colors.errorSubtle }]}>
              <Ionicons name="alert-circle" size={44} color={colors.error} />
            </View>
            <Text style={styles.title}>Алдаа гарлаа</Text>
            <Text style={styles.sub}>{error}</Text>
            <View style={styles.actions}>
              <PrimaryButton title="Дахин оролдох" onPress={retry} testID="bank-retry" />
            </View>
          </View>
        ) : status === "REJECTED" ? (
          <View style={styles.center}>
            <View style={[styles.badge, { backgroundColor: colors.errorSubtle }]}>
              <Ionicons name="close-circle" size={44} color={colors.error} />
            </View>
            <Text style={styles.title}>Баталгаажаагүй</Text>
            <Text style={styles.sub}>
              Шилжүүлэг олдсонгүй. Гүйлгээний утгаа шалгаад дахин оролдоно уу.
            </Text>
            <View style={styles.actions}>
              <PrimaryButton title="Дахин оролдох" onPress={retry} testID="bank-again" />
            </View>
          </View>
        ) : status === "PENDING" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
            <Text style={styles.title}>Шалгаж байна…</Text>
            <Text style={styles.sub}>
              Шилжүүлгийг баталгаажуулмагц PRO эрх автоматаар нээгдэнэ. Аппаа хаасан ч болно —
              дараа нь орход идэвхтэй байх болно.
            </Text>
            <View style={styles.refPill}>
              <Text style={styles.refPillText}>{req?.ref}</Text>
            </View>
            <View style={styles.actions}>
              <PrimaryButton
                title="Хаах"
                variant="secondary"
                onPress={onClose}
                testID="bank-close-pending"
              />
            </View>
          </View>
        ) : req && bank ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Дансаар шилжүүлэх</Text>
            <Text style={styles.amount}>{req.amount.toLocaleString("en-US")}₮</Text>

            {bank.qrUrl ? (
              <>
                <View style={styles.qrBox}>
                  <Image
                    style={styles.qr}
                    source={{ uri: imageUrl(bank.qrUrl) }}
                    contentFit="contain"
                    testID="bank-qr"
                  />
                </View>
                <Text style={styles.qrNote}>
                  Банкны аппаараа QR-г уншуулаад дүн, гүйлгээний утгаа доорхоос хуулж бичнэ үү.
                </Text>
              </>
            ) : null}

            <Row
              label="Банк"
              value={bank.bankName}
              onCopy={() => copy(bank.bankName, "bank")}
              copied={copied === "bank"}
            />
            <Row
              label="Дансны дугаар"
              value={bank.accountNumber}
              onCopy={() => copy(bank.accountNumber, "acc")}
              copied={copied === "acc"}
              big
            />
            <Row
              label="Хүлээн авагч"
              value={bank.accountName}
              onCopy={() => copy(bank.accountName, "name")}
              copied={copied === "name"}
            />
            <Row
              label="Дүн"
              value={String(req.amount)}
              onCopy={() => copy(String(req.amount), "amt")}
              copied={copied === "amt"}
            />
            <Row
              label="Гүйлгээний утга (заавал)"
              value={req.ref}
              onCopy={() => copy(req.ref, "ref")}
              copied={copied === "ref"}
              big
              highlight
            />

            <Text style={styles.warn}>
              Гүйлгээний утгад заавал <Text style={styles.warnCode}>{req.ref}</Text> гэж бичнэ үү.
              Үгүй бол таны төлбөрийг таньж чадахгүй.
            </Text>

            <View style={{ marginTop: 18 }}>
              <PrimaryButton
                title="Шилжүүлсэн"
                icon="checkmark-circle-outline"
                loading={claim.isPending}
                onPress={() => claim.mutate()}
                testID="bank-claim"
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <PrimaryButton
                title="Хаах"
                variant="secondary"
                onPress={onClose}
                testID="bank-close"
              />
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  onCopy,
  copied,
  big,
  highlight,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  big?: boolean;
  highlight?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.row, highlight && { borderColor: colors.brandPrimary }]}
      onPress={onCopy}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, big && styles.rowValueBig]} selectable>
          {value}
        </Text>
      </View>
      <View style={styles.copyBtn}>
        <Ionicons
          name={copied ? "checkmark" : "copy-outline"}
          size={18}
          color={colors.brandPrimary}
        />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: colors.overlay,
  },
  sheet: {
    marginTop: "auto",
    maxHeight: "90%",
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
    marginBottom: 6,
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
    marginTop: 8,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qr: { width: 200, height: 200 },
  qrNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 6,
    fontFamily: font.regular,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  rowLabel: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  rowValue: { color: colors.onSurface, fontSize: 15, fontFamily: font.semibold, marginTop: 2 },
  rowValueBig: { fontSize: 19, fontFamily: font.extrabold, letterSpacing: 0.5 },
  copyBtn: { paddingLeft: 4 },
  refPill: {
    marginTop: 14,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refPillText: {
    color: colors.onSurface,
    fontSize: 16,
    fontFamily: font.extrabold,
    letterSpacing: 0.5,
  },
  warn: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
    fontFamily: font.regular,
  },
  warnCode: { color: colors.brandPrimary, fontFamily: font.extrabold },
}));
