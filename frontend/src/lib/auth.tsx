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

type AuthState = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  /** Set when Google sign-in is not configured for this build. */
  configError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

// One OAuth client per platform, from Google Cloud Console.
const CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // Ask Google for an ID token directly: the backend verifies it against
  // Google's signing keys and mints a session of our own.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(CLIENT_IDS);

  const configError = CLIENT_IDS.webClientId
    ? null
    : "Google нэвтрэлт тохируулагдаагүй байна (EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB).";

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
      value={{ user, loading, signingIn, configError, login, logout, refreshUser, setUser }}
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
