import { useQuery } from "@tanstack/react-query";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";

import { api, clearToken, loadToken, setToken } from "@/src/lib/api";

WebBrowser.maybeCompleteAuthSession();

export type User = {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
  profileName?: string | null;
  isPro?: boolean;
  proActivatedAt?: string | null;
  proSource?: string | null;
  createdAt?: string;
};

type PublicConfig = {
  google: {
    webClientId: string | null;
    iosClientId: string | null;
    androidClientId: string | null;
  };
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  /** Set when Google sign-in is not usable, with the reason. */
  configError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

const platformKey = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

// Baked-in values still win, so a local checkout can point somewhere else.
const ENV_CLIENT_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || null,
  ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || null,
  android: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || null,
};

// expo-auth-session throws outright when the platform's client id is undefined,
// which would take the whole app down on launch. Feed it a placeholder until the
// real one arrives — the button stays disabled, so it is never actually used.
const PLACEHOLDER = "unconfigured.apps.googleusercontent.com";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // OAuth client ids come from the server so the app and the backend can never
  // disagree about which Google clients are valid, and changing one does not
  // need a new build. Client ids are public — they ship in every app binary.
  const config = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: () => api.get("/config"),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const ids = {
    web: ENV_CLIENT_IDS.web ?? config.data?.google.webClientId ?? null,
    ios: ENV_CLIENT_IDS.ios ?? config.data?.google.iosClientId ?? null,
    android: ENV_CLIENT_IDS.android ?? config.data?.google.androidClientId ?? null,
  };
  const platformClientId = ids[platformKey];

  // No redirectUri override here: the provider derives the right one per
  // platform (the bundle/package id on native) and the auth session catches it
  // itself. An app-scheme url instead reaches the router as a plain deep link,
  // which lands on "Unmatched Route" and drops the sign-in.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: ids.web || PLACEHOLDER,
    iosClientId: ids.ios || PLACEHOLDER,
    androidClientId: ids.android || PLACEHOLDER,
  });
  const configError = platformClientId
    ? null
    : config.isPending
      ? null // still loading; the button shows a spinner instead
      : config.isError
        ? "Серверт холбогдож чадсангүй. Интернэтээ шалгана уу."
        : `Google нэвтрэлт серверт тохируулагдаагүй байна (GOOGLE_CLIENT_ID_${platformKey.toUpperCase()}).`;

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.get<User>("/auth/me"));
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  // Restore an existing session on launch.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await loadToken()) await refreshUser();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshUser]);

  // Trade the ID token Google handed back for our session token.
  const exchanged = useRef<string | null>(null);
  useEffect(() => {
    // Cancelled and dismissed cases are handled where promptAsync resolves.
    if (response?.type !== "success") return;
    const idToken = response.params?.id_token ?? response.authentication?.idToken;
    if (!idToken || exchanged.current === idToken) return;
    exchanged.current = idToken;

    api
      .post<{ session_token: string; user: User }>("/auth/google", { id_token: idToken })
      .then(async (res) => {
        await setToken(res.session_token);
        setUser(res.user);
      })
      .catch((e) => console.log("google sign-in exchange failed", e))
      .finally(() => setSigningIn(false));
  }, [response]);

  const login = useCallback(async () => {
    if (!request) return;
    setSigningIn(true);
    try {
      const result = await promptAsync();
      // Dismissed or cancelled: the response effect never fires, so clear here.
      if (result?.type !== "success") setSigningIn(false);
    } catch (e) {
      console.log("google sign-in failed", e);
      setSigningIn(false);
    }
  }, [promptAsync, request]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // the local session is dropped either way
    }
    await clearToken();
    exchanged.current = null;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        // Keep the sign-in button busy while the client ids are still arriving.
        signingIn: signingIn || (!user && config.isPending),
        configError,
        login,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}