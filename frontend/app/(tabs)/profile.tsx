import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { ProModal } from "@/src/components/ProModal";
import { Badge, Card, PrimaryButton, ProgressBar } from "@/src/components/ui";
import { ApiError, api } from "@/src/lib/api";
import { useAuth, type User } from "@/src/lib/auth";
import {
  DEFAULT_REMINDER_HOUR,
  REMINDER_HOURS,
  cancelAllReminders,
  getReminderSettings,
  requestNotificationPermission,
  rescheduleReminders,
  saveReminderSettings,
} from "@/src/lib/notifications";
import {
  getReduceMotionPreference,
  setReduceMotionPreference,
  useReducedMotion,
} from "@/src/lib/motion";
import { downloadForOffline, getLastOfflineSave, type DownloadProgress } from "@/src/lib/offline-download";
import { ACCENTS, ACCENT_KEYS, setAccent, useAccent, type AccentKey } from "@/src/lib/accent";
import { getSoundEnabled, playCorrect, setSoundEnabled } from "@/src/lib/sounds";
import { getDailyGoal } from "@/src/lib/progress-local";
import { useResponsive } from "@/src/lib/responsive";
import { useBottomTabBarHeight } from "@/src/lib/tab-bar";
import { useThemeMode } from "@/src/lib/theme-mode";
import { useNameCheck } from "@/src/lib/use-name-check";
import { font, makeStyles, useTheme } from "@/src/theme";

export default function Profile() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, logout, setUser } = useAuth();
  const { mode, setMode } = useThemeMode();
  const qc = useQueryClient();
  const [proOpen, setProOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const accent = useAccent();
  const tabBarHeight = useBottomTabBarHeight();
  const { contentWidthStyle } = useResponsive();

  // Poll for PRO status so it refreshes without manual reload. Once the user is
  // PRO there is nothing left to wait for, so stop.
  const me = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me"),
    refetchInterval: user?.isPro ? false : 15000,
  });
  useEffect(() => {
    if (me.data && me.data.isPro !== user?.isPro) {
      setUser(me.data);
      qc.invalidateQueries({ queryKey: ["limits"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    }
  }, [me.data, user?.isPro, setUser, qc]);

  const isPro = user?.isPro;

  const payments = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => api.get("/payments"),
  });

  const copyName = async () => {
    if (!user?.profileName) return;
    await Clipboard.setStringAsync(user.profileName);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[
        styles.content,
        contentWidthStyle,
        { paddingTop: insets.top + 16, paddingBottom: tabBarHeight + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <OfflineBanner compact />

      <View style={styles.avatar}>
        <Ionicons name="person" size={40} color={colors.brandPrimary} />
      </View>

      <View style={styles.nameCard}>
        <Text style={styles.nameLabel}>Профайл нэр</Text>
        <View style={styles.nameRow}>
          <Text style={styles.nameValue} testID="profile-name-display">{user?.profileName}</Text>
          <Pressable
            onPress={copyName}
            style={styles.copyBtn}
            testID="copy-name-button"
            accessibilityRole="button"
            accessibilityLabel={copied ? "Хууллаа" : "Профайл нэрийг хуулах"}
          >
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={colors.brandPrimary} />
          </Pressable>
        </View>
        <View style={{ marginTop: 8, flexDirection: "row" }}>
          <Badge label={isPro ? "PRO гишүүн" : "Үнэгүй хувилбар"} tone={isPro ? "success" : "muted"} icon={isPro ? "star" : "lock-closed"} />
        </View>
      </View>

      {!isPro ? (
        <Pressable
          style={styles.upgradeCard}
          onPress={() => setProOpen(true)}
          testID="upgrade-pro-card"
          accessibilityRole="button"
          accessibilityLabel="PRO болох — бүх бүлэг, хязгааргүй асуулт"
        >
          <View style={styles.upgradeIcon}>
            <Ionicons name="star" size={22} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upgradeTitle}>PRO болох</Text>
            <Text style={styles.upgradeSub}>Бүх бүлэг, хязгааргүй асуулт, шалгалт</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ) : null}

      <Text style={styles.section}>Хялбар байдал</Text>
      <MotionCard />
      <SoundCard />

      <Text style={styles.section}>Сануулга</Text>
      <ReminderCard />

      <Text style={styles.section}>Офлайн</Text>
      <OfflineCard />

      <Text style={styles.section}>Тохиргоо</Text>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row icon="create-outline" label="Нэр өөрчлөх" onPress={() => setEditOpen(true)} testID="edit-name-row" />
        <View style={styles.rowDivider} />
        <View style={styles.themeRow}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><Ionicons name="contrast-outline" size={20} color={colors.brandPrimary} /></View>
            <Text style={styles.rowLabel}>Дэлгэцийн горим</Text>
          </View>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.themeRow}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}>
              <Ionicons name="color-palette-outline" size={20} color={colors.brandPrimary} />
            </View>
            <Text style={styles.rowLabel}>Үндсэн өнгө</Text>
            {!isPro ? (
              <View style={styles.proTag}>
                <Ionicons name="star" size={10} color={colors.onWarningSubtle} />
                <Text style={styles.proTagText}>PRO</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.accentRow}>
          {ACCENT_KEYS.map((key: AccentKey) => {
            const a = ACCENTS[key];
            const active = accent === key;
            return (
              <Pressable
                key={key}
                testID={`accent-${key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Үндсэн өнгө: ${a.label}`}
                onPress={() => {
                  if (!isPro) {
                    setProOpen(true);
                    return;
                  }
                  setAccent(key);
                  Haptics.selectionAsync().catch(() => {});
                }}
                style={[
                  styles.accentDot,
                  { backgroundColor: a.swatch },
                  active && { borderColor: colors.onSurface, borderWidth: 3 },
                  !isPro && { opacity: 0.55 },
                ]}
              >
                {active ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.segment}>
          {([
            { key: "system", label: "Систем", icon: "phone-portrait-outline" },
            { key: "light", label: "Гэрэл", icon: "sunny-outline" },
            { key: "dark", label: "Бараан", icon: "moon-outline" },
          ] as const).map((opt) => {
            const active = mode === opt.key;
            return (
              <Pressable
                key={opt.key}
                testID={`theme-${opt.key}`}
                onPress={() => setMode(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Дэлгэцийн горим: ${opt.label}`}
                style={[styles.segItem, active && { backgroundColor: colors.brandPrimary }]}
              >
                <Ionicons name={opt.icon as any} size={16} color={active ? colors.onBrandPrimary : colors.muted} />
                <Text style={[styles.segText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {isPro ? (
        <>
          <Text style={styles.section}>PRO</Text>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Row
              icon="star"
              label={`Идэвхжсэн: ${(user?.proActivatedAt || "").slice(0, 10) || "-"}`}
              onPress={undefined}
              testID="pro-activated-row"
              noChevron
            />
          </Card>
        </>
      ) : null}

      {payments.data?.length ? (
        <>
          <Text style={styles.section}>Төлбөрийн түүх</Text>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {payments.data.map((p, i) => (
              <View key={p.payment_id}>
                {i > 0 ? <View style={styles.rowDivider} /> : null}
                <PaymentRow payment={p} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Text style={styles.section}>Бүртгэл</Text>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row icon="mail-outline" label={user?.email || "-"} onPress={undefined} testID="email-row" noChevron />
      </Card>

      <View style={{ marginTop: 20 }}>
        <PrimaryButton title="Гарах" variant="danger" icon="log-out-outline" onPress={logout} testID="logout-button" />
      </View>

      <ProModal visible={proOpen} onClose={() => setProOpen(false)} profileName={user?.profileName} />
      {editOpen ? (
        <EditNameModal
          onClose={() => setEditOpen(false)}
          current={user?.profileName || ""}
          onSaved={(u) => {
            setUser(u);
            setEditOpen(false);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

type Payment = {
  payment_id: string;
  method: "qpay" | "bank";
  status: "NEW" | "PENDING" | "PAID" | "REJECTED" | "CANCELED";
  amount: number;
  createdAt?: string;
  paidAt?: string | null;
};

const PAYMENT_STATUS: Record<Payment["status"], { label: string; tone: "success" | "warn" | "muted" }> = {
  PAID: { label: "Төлөгдсөн", tone: "success" },
  PENDING: { label: "Хүлээгдэж буй", tone: "warn" },
  NEW: { label: "Дуусаагүй", tone: "muted" },
  REJECTED: { label: "Татгалзсан", tone: "muted" },
  CANCELED: { label: "Цуцалсан", tone: "muted" },
};

function PaymentRow({ payment }: { payment: Payment }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meta = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.NEW;
  const tint =
    meta.tone === "success" ? colors.success : meta.tone === "warn" ? colors.warning : colors.muted;
  return (
    <View style={styles.row} testID={`payment-${payment.payment_id}`}>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons
            name={payment.method === "qpay" ? "qr-code-outline" : "card-outline"}
            size={18}
            color={tint}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{payment.amount.toLocaleString("en-US")}₮</Text>
          <Text style={styles.paymentSub}>
            {(payment.paidAt || payment.createdAt || "").slice(0, 10)} · {meta.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Short chime on a correct answer, soft blip on a wrong one. */
function SoundCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [on, setOn] = useState(false);

  useEffect(() => {
    getSoundEnabled().then(setOn).catch(() => {});
  }, []);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    await setSoundEnabled(next);
    Haptics.selectionAsync().catch(() => {});
    // Play the sound once so the switch demonstrates itself.
    if (next) playCorrect();
  };

  return (
    <Card testID="sound-card">
      <Pressable
        style={styles.rowLeft}
        onPress={toggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel="Хариултын дуу"
        testID="sound-toggle"
      >
        <View style={styles.rowIcon}>
          <Ionicons
            name={on ? "volume-high-outline" : "volume-mute-outline"}
            size={20}
            color={on ? colors.brandPrimary : colors.muted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Хариултын дуу</Text>
          <Text style={styles.paymentSub}>
            {on ? "Зөв/буруу дээр богино дуу гарна" : "Чимээгүй — зөвхөн чичиргээ"}
          </Text>
        </View>
        <View style={[styles.switchTrack, on && { backgroundColor: colors.brandPrimary }]}>
          <View style={[styles.switchKnob, on && { alignSelf: "flex-end" }]} />
        </View>
      </Pressable>
    </Card>
  );
}

/** Turns off decorative animation for people who find it distracting. */
function MotionCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const active = useReducedMotion();
  const [pref, setPref] = useState(false);

  useEffect(() => {
    getReduceMotionPreference().then(setPref).catch(() => {});
  }, []);

  const toggle = async () => {
    const next = !pref;
    setPref(next);
    await setReduceMotionPreference(next);
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Card testID="motion-card">
      <Pressable
        style={styles.rowLeft}
        onPress={toggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: pref }}
        accessibilityLabel="Хөдөлгөөн багасгах"
        testID="motion-toggle"
      >
        <View style={styles.rowIcon}>
          <Ionicons
            name={active ? "pause-circle-outline" : "sparkles-outline"}
            size={20}
            color={active ? colors.brandPrimary : colors.muted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Хөдөлгөөн багасгах</Text>
          <Text style={styles.paymentSub}>
            {active && !pref
              ? "Утасны тохиргооноос идэвхжсэн байна"
              : "Анимаци, шаржигнуурыг унтраана"}
          </Text>
        </View>
        <View style={[styles.switchTrack, pref && { backgroundColor: colors.brandPrimary }]}>
          <View style={[styles.switchKnob, pref && { alignSelf: "flex-end" }]} />
        </View>
      </Pressable>
    </Card>
  );
}

/** Daily study reminder: on/off plus the hour it fires. */
function ReminderCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(DEFAULT_REMINDER_HOUR);
  const [denied, setDenied] = useState(false);

  const limits = useQuery<{ questionsAnswered: number }>({
    queryKey: ["limits"],
    queryFn: () => api.get("/me/limits"),
  });
  const stats = useQuery<{ currentStreak: number }>({
    queryKey: ["stats"],
    queryFn: () => api.get("/stats"),
  });

  useEffect(() => {
    getReminderSettings()
      .then((s) => {
        setEnabled(s.enabled);
        setHour(s.hour);
      })
      .catch(() => {});
  }, []);

  const apply = async (next: { enabled: boolean; hour: number }) => {
    setEnabled(next.enabled);
    setHour(next.hour);
    await saveReminderSettings(next);
    if (!next.enabled) {
      await cancelAllReminders();
      return;
    }
    const ok = await requestNotificationPermission();
    if (!ok) {
      setDenied(true);
      setEnabled(false);
      await saveReminderSettings({ ...next, enabled: false });
      return;
    }
    setDenied(false);
    const goal = await getDailyGoal();
    await rescheduleReminders({
      answeredToday: limits.data?.questionsAnswered ?? 0,
      dailyGoal: goal,
      streak: stats.data?.currentStreak ?? 0,
    });
  };

  return (
    <Card style={{ gap: 12 }} testID="reminder-card">
      <Pressable
        style={styles.rowLeft}
        onPress={() => apply({ enabled: !enabled, hour })}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        accessibilityLabel="Өдөр тутмын сануулга"
        testID="reminder-toggle"
      >
        <View style={styles.rowIcon}>
          <Ionicons
            name={enabled ? "notifications" : "notifications-off-outline"}
            size={20}
            color={enabled ? colors.brandPrimary : colors.muted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Өдөр тутмын сануулга</Text>
          <Text style={styles.paymentSub}>
            {enabled ? `Өдөр бүр ${hour}:00 цагт` : "Streak тасрахаас өмнө сануулна"}
          </Text>
        </View>
        <View style={[styles.switchTrack, enabled && { backgroundColor: colors.brandPrimary }]}>
          <View style={[styles.switchKnob, enabled && { alignSelf: "flex-end" }]} />
        </View>
      </Pressable>

      {enabled ? (
        <View style={styles.hourRow}>
          {REMINDER_HOURS.map((h) => {
            const active = h === hour;
            return (
              <Pressable
                key={h}
                onPress={() => apply({ enabled: true, hour: h })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${h} цагт сануулах`}
                testID={`reminder-hour-${h}`}
                style={[styles.hourChip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              >
                <Text style={[styles.hourText, active && { color: colors.onBrandPrimary }]}>{h}:00</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {denied ? (
        <Text style={[styles.paymentSub, { color: colors.warning }]}>
          Мэдэгдэл хаалттай байна. Утасны тохиргооноос зөвшөөрнө үү.
        </Text>
      ) : null}
    </Card>
  );
}

/** Downloads every unlocked category so the app keeps working with no signal. */
function OfflineCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLastOfflineSave().then(setSavedAt).catch(() => {});
  }, []);

  const busy = progress !== null && progress.phase !== "done";
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const phaseLabel =
    progress?.phase === "categories"
      ? "Бүлгүүдийг татаж байна..."
      : progress?.phase === "questions"
        ? `Асуултууд ${progress.done}/${progress.total}`
        : progress?.phase === "images"
          ? `Зургууд ${progress.done}/${progress.total}`
          : "";

  const run = async () => {
    setError(null);
    setProgress({ phase: "categories", done: 0, total: 1 });
    try {
      await downloadForOffline(setProgress);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSavedAt(new Date().toISOString());
    } catch {
      setError("Татаж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <Card style={{ gap: 12 }} testID="offline-card">
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name="cloud-download-outline" size={20} color={colors.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Офлайн ашиглах</Text>
          <Text style={styles.paymentSub}>
            {savedAt
              ? `Сүүлд татсан: ${savedAt.slice(0, 10)}`
              : "Асуулт, зургийг утсандаа хадгалж интернэтгүй давт"}
          </Text>
        </View>
      </View>

      {busy ? (
        <View style={{ gap: 6 }}>
          <ProgressBar percent={pct} />
          <Text style={styles.paymentSub}>{phaseLabel}</Text>
        </View>
      ) : (
        <PrimaryButton
          title={savedAt ? "Дахин шинэчлэх" : "Офлайн татах"}
          icon="cloud-download-outline"
          variant={savedAt ? "secondary" : "primary"}
          onPress={run}
          testID="offline-download-button"
        />
      )}
      {error ? <Text style={[styles.paymentSub, { color: colors.error }]}>{error}</Text> : null}
    </Card>
  );
}

function Row({ icon, label, onPress, testID, noChevron }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: colors.surfaceTertiary }]}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}><Ionicons name={icon} size={20} color={colors.brandPrimary} /></View>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      </View>
      {!noChevron ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

/** Mounted only while open, so it always starts from the current name. */
function EditNameModal({
  onClose,
  current,
  onSaved,
}: {
  onClose: () => void;
  current: string;
  onSaved: (u: User) => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { name, setName, status, checking } = useNameCheck(current);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post<User>("/profile/set-name", { name }),
    onSuccess: onSaved,
    onError: (e) => {
      // A taken or invalid name used to fail silently, leaving the sheet open
      // with no explanation.
      setSaveError(e instanceof ApiError ? e.message : "Хадгалж чадсангүй. Дахин оролдоно уу.");
    },
  });

  const canSave = !!name && name !== current && !!status?.valid && !!status?.available;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.editSheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.handle} />
        <Text style={styles.editTitle}>Профайл нэр өөрчлөх</Text>
        <View
          style={[
            styles.inputWrap,
            { borderColor: status == null ? colors.border : status.available ? colors.success : colors.error },
          ]}
        >
          <Ionicons name="at-outline" size={20} color={colors.muted} />
          <TextInput
            testID="edit-name-input"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {checking ? <ActivityIndicator color={colors.muted} /> : null}
        </View>
        {status && !status.available ? (
          <Text style={[styles.helper, { color: colors.error }]}>{status.reason}</Text>
        ) : null}
        {saveError ? (
          <Text style={[styles.helper, { color: colors.error }]} testID="save-name-error">
            {saveError}
          </Text>
        ) : null}
        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            testID="save-edit-name"
            title="Хадгалах"
            onPress={() => {
              setSaveError(null);
              save.mutate();
            }}
            disabled={!canSave}
            loading={save.isPending}
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  accentRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  accentDot: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  proTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.warningSubtle,
  },
  proTagText: { color: colors.onWarningSubtle, fontSize: 10, fontFamily: font.bold },
  switchTrack: {
    width: 46,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    padding: 3,
    justifyContent: "center",
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  hourRow: { flexDirection: "row", gap: 8 },
  hourChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  hourText: { color: colors.onSurfaceTertiary, fontSize: 13, fontFamily: font.bold },
  content: { paddingHorizontal: 20 },
  avatar: {
    width: 84, height: 84, borderRadius: 26, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16,
  },
  nameCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border },
  nameLabel: { color: colors.muted, fontSize: 12, fontFamily: font.semibold, textTransform: "uppercase" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  nameValue: { color: colors.onSurface, fontSize: 24, fontFamily: font.extrabold, flex: 1 },
  copyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  upgradeCard: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14,
    backgroundColor: colors.surfaceSecondary, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border,
  },
  upgradeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.warningSubtle, alignItems: "center", justifyContent: "center" },
  upgradeTitle: { color: colors.onSurface, fontSize: 16, fontFamily: font.bold },
  upgradeSub: { color: colors.muted, fontSize: 13, fontFamily: font.regular },
  section: { color: colors.muted, fontSize: 13, fontFamily: font.bold, textTransform: "uppercase", marginTop: 24, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { color: colors.onSurface, fontSize: 15, fontFamily: font.medium, flex: 1 },
  paymentSub: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: 2 },
  rowDivider: { height: 1, backgroundColor: colors.divider, marginLeft: 62 },
  themeRow: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 8 },
  segment: { flexDirection: "row", gap: 8, padding: 12, paddingTop: 0 },
  segItem: {
    flex: 1, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surfaceTertiary,
  },
  segText: { fontSize: 13, fontFamily: font.semibold },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  editSheet: {
    marginTop: "auto", backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 },
  editTitle: { color: colors.onSurface, fontSize: 18, fontFamily: font.bold, marginBottom: 14 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, backgroundColor: colors.surfaceTertiary,
  },
  input: { flex: 1, fontSize: 17, color: colors.onSurface, fontFamily: font.semibold },
  helper: { fontSize: 13, marginTop: 8, fontFamily: font.medium },
}));
