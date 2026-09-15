import Ionicons from "@react-native-vector-icons/ionicons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BankTransferModal } from "@/src/components/BankTransferModal";
import { QPayModal } from "@/src/components/QPayModal";
import { PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { TOTAL_CATEGORIES } from "@/src/lib/content";
import { font, makeStyles, useTheme } from "@/src/theme";

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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [payOpen, setPayOpen] = useState<"qpay" | "bank" | null>(null);

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
    <Modal visible={visible && !payOpen} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="pro-modal-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} testID="pro-modal">
        <View style={styles.handle} />
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

        <Text style={styles.instr}>
          Эсвэл өөрийн профайл нэрээ <Text style={styles.bot}>{BOT}</Text> руу илгээж гараар идэвхжүүлнэ:
        </Text>

        <Pressable style={styles.nameBox} onPress={copy} testID="pro-copy-name">
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
    </Modal>

    {payOpen === "qpay" ? (
      // PRO is live; close the upsell behind the success screen too.
      <QPayModal onClose={() => setPayOpen(null)} onPaid={onClose} />
    ) : null}

    {payOpen === "bank" ? (
      <BankTransferModal onClose={() => setPayOpen(null)} onPaid={onClose} />
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
  backdrop: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: colors.overlay },
  sheet: {
    marginTop: "auto",
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 },
  crown: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: colors.warningSubtle,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12,
  },
  title: { color: colors.onSurface, fontSize: 21, fontFamily: font.extrabold, textAlign: "center" },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, fontFamily: font.regular },
  benefits: { marginTop: 18, gap: 12 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitText: { color: colors.onSurfaceSecondary, fontSize: 15, fontFamily: font.medium },
  price: { color: colors.brandPrimary, fontSize: 28, fontFamily: font.extrabold, textAlign: "center", marginBottom: 2 },
  payNote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 8, fontFamily: font.regular },
  instr: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: 20, fontFamily: font.regular },
  bot: { color: colors.brandPrimary, fontFamily: font.bold },
  nameBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameText: { color: colors.onSurface, fontSize: 18, fontFamily: font.bold },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  copyText: { color: colors.brandPrimary, fontSize: 14, fontFamily: font.semibold },
}));
