import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { UpdateBanner } from "@/src/components/UpdateBanner";
import { AuthProvider } from "@/src/lib/auth";
import { initAccent } from "@/src/lib/accent";
import { initMotionPreferences } from "@/src/lib/motion";
import { configureNotificationHandler } from "@/src/lib/notifications";
import { installGlobalErrorHandler } from "@/src/lib/report-error";
import { initSounds } from "@/src/lib/sounds";
import { flushAnswers } from "@/src/lib/offline-queue";
import { CACHE_BUSTER, queryPersister, shouldPersistQueryKey } from "@/src/lib/offline";
import { ThemeModeProvider } from "@/src/lib/theme-mode";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

const PERSIST_OPTIONS = {
  persister: queryPersister,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: any) =>
      q.state.status === "success" && shouldPersistQueryKey(q.queryKey),
  },
};

// Warnings stay visible while developing; only release builds hide the overlay.
LogBox.ignoreAllLogs(!__DEV__);

// Uncaught JS errors are reported to our own backend (see /api/client-error).
installGlobalErrorHandler();

// Foreground notifications should still be visible — otherwise a reminder that
// arrives while the app is open disappears silently.
configureNotificationHandler();

function StackNav() {
  const { colors, scheme } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: "fade",
        }}
      />
      <UpdateBanner />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    "Manrope-Regular": require("../assets/fonts/Manrope-Regular.ttf"),
    "Manrope-Medium": require("../assets/fonts/Manrope-Medium.ttf"),
    "Manrope-SemiBold": require("../assets/fonts/Manrope-SemiBold.ttf"),
    "Manrope-Bold": require("../assets/fonts/Manrope-Bold.ttf"),
    "Manrope-ExtraBold": require("../assets/fonts/Manrope-ExtraBold.ttf"),
  });

  // Reduce-motion: read the OS setting and the in-app switch, then keep
  // watching the OS one.
  useEffect(() => initMotionPreferences(), []);

  // Answer sounds are off unless the user turned them on.
  useEffect(() => initSounds(), []);

  // Restore the chosen accent colour before the first paint of the tabs.
  useEffect(() => {
    initAccent().catch(() => {});
  }, []);

  // Answers given offline are replayed whenever the app comes back to the
  // foreground; if the network is still down they simply stay queued.
  useEffect(() => {
    const replay = () => {
      flushAnswers()
        .then((n) => {
          if (n > 0) {
            queryClient.invalidateQueries({ queryKey: ["stats"] });
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            queryClient.invalidateQueries({ queryKey: ["limits"] });
          }
        })
        .catch(() => {});
    };
    replay();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") replay();
    });
    return () => sub.remove();
  }, []);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: "#F8FAFC" }} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={PERSIST_OPTIONS}>
            <ThemeModeProvider>
              <BottomSheetModalProvider>
                <AuthProvider>
                  <StackNav />
                </AuthProvider>
              </BottomSheetModalProvider>
            </ThemeModeProvider>
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
