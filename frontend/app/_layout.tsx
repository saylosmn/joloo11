import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox, Text as RNText, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { AuthProvider } from "@/src/lib/auth";
import { ThemeModeProvider } from "@/src/lib/theme-mode";
import { queryClient } from "@/src/query-client";
import { font, useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function StackNav() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: "fade",
        }}
      />
    </>
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

  useEffect(() => {
    if (loaded) {
      const T = RNText as any;
      T.defaultProps = T.defaultProps || {};
      T.defaultProps.style = [{ fontFamily: font.regular }, T.defaultProps.style];
      T.defaultProps.allowFontScaling = false;
    }
  }, [loaded]);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: "#F8FAFC" }} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeModeProvider>
              <BottomSheetModalProvider>
                <AuthProvider>
                  <StackNav />
                </AuthProvider>
              </BottomSheetModalProvider>
            </ThemeModeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
