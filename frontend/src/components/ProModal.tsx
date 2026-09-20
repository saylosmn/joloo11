import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/src/components/AppText";
import { BankTransferModal } from "@/src/components/BankTransferModal";
import { QPayModal } from "@/src/components/QPayModal";
import { Sheet } from "@/src/components/Sheet";
import { PromoCodeBox } from "@/src/components/PromoCodeBox";
import { PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { TOTAL_CATEGORIES } from "@/src/lib/content";
import { font, makeStyles, radius, spacing, type, useTheme } from "@/src/theme";

const BOT = "@zhd_exam_bot";

type Plan = {
  name: string;
  amount: number;
  currency: string;
  enabled: boolean;
  qpay: boolean;
  bankTransfer: boolean;
};

export function ProModal({
  visible,
  onClose,
  profileName,
  reason,
}: {
  visible: boolean;
  onClose: () => void;
  profileName?: string | null;
  reason?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [payOpen, setPayOpen] = useState<"qpay" | "bank" | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);
  const qc = useQueryClient();
  const router = useRouter();

  // Every way into PRO ends on the same celebratory screen, so nobody is left
  // wondering whether their payment actually went through.
  const celebrate = (via: "paid" | "trial" | "promo") => {
    onClose();
    router.push(`/pro/success?via=${via}` as never);
  };

  // A short free trial converts far better than a wall of feature bullets.
  const limits = useQuery<{ trialAvailable?: boolean; trialDays?: number }>({
    queryKey: ["limits"],
    queryFn: () => api.get("/me/limits"),
    enabled: visible,
  });

  const trial = useMutation({
    mutationFn: () => api.post("/pro/trial"),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["limits"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      celebrate("trial");
    },
    onError: (e: any) => setTrialError(e?.message ?? "Идэвхжүүлж чадсангүй"),
  });

  // Price/availability come from the backend so the QPay button stays hidden
  // when merchant credentials are not configured.
  useEffect(() => {
    if (!visible || plan) return;
    api.get<Plan>("/payments/plan").then(setPlan).catch(() => setPlan(null));
  }, [visible, plan]);

  const copy = async () => {
    if (!profileName) return;
    await Clipboard.setStringAsync(profileName);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
    <Sheet visible={visible && !payOpen} onClose={onClose} snapPoints={["85%"]} testID="pro-modal">
      <View>
        <View style={styles.crown}>
          <Ionicons name="star" size={30} color={colors.warning} />
        </View>
        <Text style={styles.title}>PRO болон бүх боломжийг нээ</Text>
        <Text style={styles.sub}>
          {reason ||
            `Бүх ${TOTAL_CATEGORIES} бүлэг, хязгааргүй асуулт, хязгааргүй шалгалт, алдаатай асуултын горим.`}
        </Text>

        <View style={styles.benefits}>
          <Benefit text={`Бүх ${TOTAL_CATEGORIES} бүлэг нээлттэй`} />
          <Benefit text="Өдрийн асуултын хязгааргүй" />
          <Benefit text="Хязгааргүй шалгалт" />
          <Benefit text="Алдаатай асуултын давталт" />
        </View>

        {limits.data?.trialAvailable ? (
          <View style={{ marginTop: 18, gap: 8 }}>
            <PrimaryButton
              title={`${limits.data.trialDays ?? 3} хоног үнэгүй туршиж үзэх`}
              icon="gift"
              loading={trial.isPending}
              onPress={() => trial.mutate()}
              testID="pro-trial"
            />
            <Text style={styles.payNote}>
              Картын мэдээлэл шаардахгүй. Хугацаа дуусахад автоматаар үнэгүй хувилбар руу буцна.
            </Text>
            {trialError ? <Text style={[styles.payNote, { color: colors.error }]}>{trialError}</Text> : null}
          </View>
        ) : null}

        {plan?.enabled ? (
          <View style={{ marginTop: 20, gap: 10 }}>
            <Text style={styles.price}>{plan.amount.toLocaleString("en-US")}₮</Text>
            {plan.qpay ? (
              <PrimaryButton
                title="QPay-ээр төлөх"
                icon="qr-code-outline"
                onPress={() => setPayOpen("qpay")}
                testID="pro-pay-qpay"
              />
            ) : null}
            {plan.bankTransfer ? (
              <PrimaryButton
                title="Дансаар шилжүүлэх"
                icon="card-outline"
                variant={plan.qpay ? "secondary" : "primary"}
                onPress={() => setPayOpen("bank")}
                testID="pro-pay-bank"
              />
            ) : null}
            <Text style={styles.payNote}>
              {plan.qpay
                ? "Банкны аппаар эсвэл QR уншуулж төлнө."
                : "QR уншуулах эсвэл дансны дугаараар шилжүүлнэ. Баталгаажмагц PRO нээгдэнэ."}
            </Text>
          </View>
        ) : null}

        <PromoCodeBox onRedeemed={() => celebrate("promo")} />

        <Text style={styles.instr}>
          Эсвэл өөрийн профайл нэрээ <Text style={styles.bot}>{BOT}</Text> руу илгээж гараар идэвхжүүлнэ:
        </Text>

        <Pressable
          style={styles.nameBox}
          onPress={copy}
          testID="pro-copy-name"
          accessibilityRole="button"
          accessibilityLabel={`Профайл нэр ${profileName || ""} — хуулах`}
        >
          <Text style={styles.nameText}>{profileName || "-"}</Text>
          <View style={styles.copyBtn}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={colors.brandPrimary} />
            <Text style={styles.copyText}>{copied ? "Хууллаа" : "Хуулах"}</Text>
          </View>
        </Pressable>

        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            title="Ойлголоо"
            variant="secondary"
            onPress={onClose}
            testID="pro-modal-close"
          />
        </View>
      </View>
    </Sheet>

    {payOpen === "qpay" ? (
      // PRO is live; close the upsell behind the success screen too.
      <QPayModal onClose={() => setPayOpen(null)} onPaid={() => celebrate("paid")} />
    ) : null}

    {payOpen === "bank" ? (
      <BankTransferModal onClose={() => setPayOpen(null)} onPaid={() => celebrate("paid")} />
    ) : null}
    </>
  );
}

function Benefit({ text }: { text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.benefitRow}>
      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  crown: {
    width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.warningSubtle,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: type.xl + 1, fontFamily: font.extrabold, textAlign: "center" },
  sub: { color: colors.muted, fontSize: type.base, lineHeight: 21, textAlign: "center", marginTop: spacing.sm, fontFamily: font.regular },
  benefits: { marginTop: spacing.lg + 2, gap: spacing.md },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  benefitText: { color: colors.onSurfaceSecondary, fontSize: type.md, fontFamily: font.medium },
  price: { color: colors.brandPrimary, fontSize: type.title, fontFamily: font.extrabold, textAlign: "center", marginBottom: 2 },
  payNote: { color: colors.muted, fontSize: type.sm, lineHeight: 18, textAlign: "center", marginTop: spacing.sm, fontFamily: font.regular },
  instr: { color: colors.onSurfaceSecondary, fontSize: type.base, lineHeight: 21, marginTop: spacing.xl, fontFamily: font.regular },
  bot: { color: colors.brandPrimary, fontFamily: font.bold },
  nameBox: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameText: { color: colors.onSurface, fontSize: type.lg, fontFamily: font.bold },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  copyText: { color: colors.brandPrimary, fontSize: type.base, fontFamily: font.semibold },
}));
