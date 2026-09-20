import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { LoadingWheel, TrafficLightIcon } from "@/src/components/illustrations";
import { LoadingView, PrimaryButton } from "@/src/components/ui";
import { ApiError, api } from "@/src/lib/api";
import { useAuth, type User } from "@/src/lib/auth";
import { isOnboarded } from "@/src/lib/onboarding";
import { TOTAL_CATEGORIES, TOTAL_QUESTIONS } from "@/src/lib/content";
import { useNameCheck } from "@/src/lib/use-name-check";
import { font, makeStyles, useTheme } from "@/src/theme";

export default function Entry() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B1220" }}>
        <LoadingView label="Ачааллаж байна..." />
      </View>
    );
  }
  if (!user) return <LoginScreen />;
  if (!user.profileName) return <ProfileSetupScreen />;
  return <RedirectHome />;
}

function RedirectHome() {
  const router = useRouter();
  useEffect(() => {
    // First run after sign-in goes through the intro; afterwards straight home.
    isOnboarded()
      // cast: expo-router regenerates typed routes on the next dev-server run
      .then((done) => router.replace((done ? "/(tabs)" : "/onboarding") as never))
      .catch(() => router.replace("/(tabs)"));
  }, [router]);
  return <LoadingView />;
}

function LoginScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { login, signingIn, configError } = useAuth();

  return (
    <View style={styles.loginRoot}>
      <LinearGradient
        colors={["#1D4ED8", "#2563EB", "#1E3A8A"]}
        style={styles.loginGradient}
      >
        <View style={[styles.loginInner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.brandBadge}>
            <TrafficLightIcon size={72} />
          </View>
          <Text style={styles.loginTitle}>Замын хөдөлгөөний{"\n"}дүрмийн шалгалт</Text>
          <Text style={styles.loginSubtitle}>
            {TOTAL_QUESTIONS} асуулт, {TOTAL_CATEGORIES} бүлэг. Давтаж бэлдээд жинхэнэ
            шалгалтдаа өөртөө итгэлтэй ор.
          </Text>

          <View style={styles.loginFeatures}>
            <Feature icon="albums-outline" text="Бүлгээр давтах" />
            <Feature icon="timer-outline" text="25 минутын жинхэнэ шалгалт" />
            <Feature icon="stats-chart-outline" text="Дэлгэрэнгүй статистик" />
          </View>

          <View style={styles.loginBottom}>
            <Pressable
              testID="google-login-button"
              disabled={signingIn || !!configError}
              onPress={login}
              style={({ pressed }) => [
                styles.googleBtn,
                { opacity: pressed || signingIn || configError ? 0.9 : 1 },
              ]}
            >
              {signingIn ? (
                <LoadingWheel size={24} color="#1E293B" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={styles.googleBtnText}>Google-ээр нэвтрэх</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.loginHint}>
              {configError ?? "Нэвтэрснээр үйлчилгээний нөхцөлийг зөвшөөрч байгаа болно."}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function Feature({ icon, text }: { icon: any; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function ProfileSetupScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { setUser } = useAuth();
  const { name, setName, status, checking } = useNameCheck();
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.post<User>("/profile/set-name", { name }),
    onSuccess: setUser,
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Хадгалахад алдаа гарлаа"),
  });

  const canSave = !!status?.valid && !!status?.available;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[styles.setupContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.setupIcon}>
        <Ionicons name="person-circle-outline" size={44} color={colors.brandPrimary} />
      </View>
      <Text style={styles.setupTitle}>Профайл нэрээ сонго</Text>
      <Text style={styles.setupSub}>
        3–20 тэмдэгт, латин үсэг, тоо, доогуур зураас (_). Энэ нэр системд давхцахгүй байх ёстой.
      </Text>

      <View
        style={[
          styles.inputWrap,
          {
            borderColor:
              status == null
                ? colors.border
                : status.available
                  ? colors.success
                  : colors.error,
          },
        ]}
      >
        <Ionicons name="at-outline" size={20} color={colors.muted} />
        <TextInput
          testID="profile-name-input"
          value={name}
          onChangeText={setName}
          placeholder="жишээ: bat_erdene"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          style={styles.input}
        />
        {checking ? <ActivityIndicator color={colors.muted} /> : null}
        {!checking && status?.available ? (
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        ) : null}
        {!checking && status && !status.available ? (
          <Ionicons name="close-circle" size={20} color={colors.error} />
        ) : null}
      </View>

      {status && !status.available ? (
        <Text testID="name-error" style={[styles.helper, { color: colors.error }]}>
          {status.reason}
        </Text>
      ) : status?.available ? (
        <Text style={[styles.helper, { color: colors.success }]}>Энэ нэр боломжтой байна ✓</Text>
      ) : (
        <Text style={styles.helper}>Латин үсэг, тоо, _ ашиглана.</Text>
      )}

      {err ? <Text style={[styles.helper, { color: colors.error }]}>{err}</Text> : null}

      <View style={{ marginTop: 24 }}>
        <PrimaryButton
          testID="save-profile-name-button"
          title="Үргэлжлүүлэх"
          onPress={() => {
            setErr(null);
            save.mutate();
          }}
          disabled={!canSave}
          loading={save.isPending}
        />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  loginRoot: { flex: 1, backgroundColor: "#1D4ED8" },
  loginGradient: { flex: 1 },
  loginInner: { flex: 1, paddingHorizontal: 28 },
  brandBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  loginTitle: { color: "#FFFFFF", fontSize: 30, fontFamily: font.extrabold, lineHeight: 38 },
  loginSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    fontFamily: font.regular,
  },
  loginFeatures: { marginTop: 32, gap: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { color: "#FFFFFF", fontSize: 15, fontFamily: font.medium },
  loginBottom: { marginTop: "auto", gap: 12 },
  googleBtn: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleBtnText: { color: "#1E293B", fontSize: 16, fontFamily: font.bold },
  loginHint: { color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "center", fontFamily: font.regular },

  setupContent: { paddingHorizontal: 24 },
  setupIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  setupTitle: { color: colors.onSurface, fontSize: 24, fontFamily: font.extrabold },
  setupSub: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24, fontFamily: font.regular },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceSecondary,
  },
  input: { flex: 1, fontSize: 17, color: colors.onSurface, fontFamily: font.semibold },
  helper: { fontSize: 13, marginTop: 8, color: colors.muted, fontFamily: font.medium },
}));
