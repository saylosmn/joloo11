import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

/** Админаас олгодог нэвтрэх кодын урт (backend: /auth/code-login). */
const CODE_LEN = 4;

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
  const { login, codeLogin, signingIn, configError } = useAuth();
  const [showCodeLogin, setShowCodeLogin] = useState(false);
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LEN).fill(""));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const digitRefs = useRef<(TextInput | null)[]>([]);

  const handleDigitChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, "");
    setCodeError(null);
    const next = [...digits];
    if (!cleaned) {
      next[index] = "";
      setDigits(next);
      return;
    }
    // Бүтэн кодыг нэг нүдэнд буулгахад үлдсэн нүднүүд рүү тараана.
    cleaned.slice(0, CODE_LEN - index).split("").forEach((d, i) => {
      next[index + i] = d;
    });
    setDigits(next);
    const landed = Math.min(index + cleaned.length, CODE_LEN - 1);
    digitRefs.current[landed]?.focus();
  };

  const handleDigitKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const fullCode = digits.join("");

  /** Сервер рүү явуулахаас өмнөх шалгалт. Алдаагүй бол null. */
  const validateCode = (code: string): string | null => {
    if (!code) return "Кодоо оруулна уу";
    if (/\D/.test(code)) return "Зөвхөн тоо оруулна уу";
    if (code.length < CODE_LEN) return `${CODE_LEN} оронтой кодоо бүтэн оруулна уу`;
    return null;
  };

  const handleCodeSubmit = async () => {
    if (codeLoading) return;
    const invalid = validateCode(fullCode);
    if (invalid) {
      setCodeError(invalid);
      digitRefs.current[Math.min(fullCode.length, CODE_LEN - 1)]?.focus();
      return;
    }
    setCodeError(null);
    setCodeLoading(true);
    try {
      await codeLogin(fullCode);
    } catch (e) {
      // Буруу код — серверийн хариултыг үзүүлээд талбарыг цэвэрлэнэ.
      setCodeError(e instanceof ApiError ? e.message : "Нэвтрэхэд алдаа гарлаа");
      setDigits(Array(CODE_LEN).fill(""));
      digitRefs.current[0]?.focus();
    } finally {
      setCodeLoading(false);
    }
  };

  if (showCodeLogin) {
    return (
      <View style={styles.loginRoot}>
        <LinearGradient
          colors={["#1D4ED8", "#2563EB", "#1E3A8A"]}
          style={styles.loginGradient}
        >
          <ScrollView
            contentContainerStyle={[styles.loginInner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => setShowCodeLogin(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>

            <View style={styles.brandBadge}>
              <Ionicons name="key-outline" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.loginTitle}>Кодоор нэвтрэх</Text>
            <Text style={styles.loginSubtitle}>
              Админаас авсан 4 оронтой кодоо оруулна уу.
            </Text>

            <View style={{ marginTop: 32, gap: 20 }}>
              <View>
                <Text style={styles.codeLabel}>4 оронтой код</Text>
                <View style={styles.codeRow}>
                  {Array.from({ length: CODE_LEN }, (_, i) => (
                    <TextInput
                      key={i}
                      testID={`code-digit-${i}`}
                      ref={(r) => { digitRefs.current[i] = r; }}
                      value={digits[i]}
                      onChangeText={(t) => handleDigitChange(t, i)}
                      onKeyPress={(e) => handleDigitKeyPress(e, i)}
                      onSubmitEditing={handleCodeSubmit}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[styles.codeInput, codeError ? styles.codeInputError : null]}
                      textAlign="center"
                      selectTextOnFocus
                    />
                  ))}
                </View>
              </View>

              {codeError ? <Text testID="code-login-error" style={styles.codeError}>{codeError}</Text> : null}

              <Pressable
                testID="code-login-submit"
                disabled={codeLoading}
                onPress={handleCodeSubmit}
                style={({ pressed }) => [
                  styles.googleBtn,
                  { opacity: pressed || codeLoading ? 0.7 : 1, marginTop: 8 },
                ]}
              >
                {codeLoading ? (
                  <LoadingWheel size={24} color="#1E293B" />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={20} color="#1D4ED8" />
                    <Text style={styles.googleBtnText}>Нэвтрэх</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.loginRoot}>
      <LinearGradient
        colors={["#1D4ED8", "#2563EB", "#1E3A8A"]}
        style={styles.loginGradient}
      >
        <ScrollView
          contentContainerStyle={[styles.loginInner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

            <Pressable
              onPress={() => setShowCodeLogin(true)}
              style={({ pressed }) => [
                styles.codeLoginBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="key-outline" size={18} color="#FFFFFF" />
              <Text style={styles.codeLoginBtnText}>Кодоор нэвтрэх</Text>
            </Pressable>

            <Text style={styles.loginHint}>
              {configError ?? "Нэвтэрснээр үйлчилгээний нөхцөлийг зөвшөөрч байгаа болно."}
            </Text>
          </View>
        </ScrollView>
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
  loginInner: { flexGrow: 1, paddingHorizontal: 28 },
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
  codeLoginBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  codeLoginBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: font.semibold },
  backBtn: { marginBottom: 20 },
  codeLabel: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: font.semibold, marginBottom: 8 },
  codeRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  codeInput: {
    width: 56,
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: font.extrabold,
  },
  codeInputError: { borderColor: "#FCA5A5", backgroundColor: "rgba(248,113,113,0.18)" },
  codeError: { color: "#FCA5A5", fontSize: 13, textAlign: "center", fontFamily: font.medium },
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
