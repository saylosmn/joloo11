// Design tokens — calm Slate Blue, light + dark. Keys match design_guidelines.json.
// Use makeStyles() for stylesheets and useTheme().colors for color props.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F8FAFC",
  onSurface: "#0F172A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1E293B",
  surfaceTertiary: "#F1F5F9",
  onSurfaceTertiary: "#334155",
  surfaceInverse: "#1E293B",
  onSurfaceInverse: "#F8FAFC",
  muted: "#64748B",

  brand: "#3B82F6",
  onBrand: "#FFFFFF",
  brandPrimary: "#2563EB",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#DBEAFE",
  onBrandSecondary: "#1E40AF",
  brandTertiary: "#EFF6FF",
  onBrandTertiary: "#2563EB",

  success: "#10B981",
  onSuccess: "#FFFFFF",
  successSubtle: "#DCFCE7",
  onSuccessSubtle: "#047857",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  warningSubtle: "#FEF3C7",
  onWarningSubtle: "#B45309",
  error: "#EF4444",
  onError: "#FFFFFF",
  errorSubtle: "#FEE2E2",
  onErrorSubtle: "#B91C1C",
  info: "#2563EB",
  onInfo: "#FFFFFF",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",

  overlay: "rgba(15,23,42,0.45)",
  gradientStart: "#2563EB",
  gradientEnd: "#1D4ED8",
  shadow: "#0F172A",
};

const dark: typeof light = {
  surface: "#0B1120",
  onSurface: "#F1F5F9",
  surfaceSecondary: "#111A2E",
  onSurfaceSecondary: "#E2E8F0",
  surfaceTertiary: "#1B263B",
  onSurfaceTertiary: "#CBD5E1",
  surfaceInverse: "#F1F5F9",
  onSurfaceInverse: "#0B1120",
  muted: "#94A3B8",

  brand: "#60A5FA",
  onBrand: "#0B1120",
  brandPrimary: "#3B82F6",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#1E3A8A",
  onBrandSecondary: "#BFDBFE",
  brandTertiary: "#172554",
  onBrandTertiary: "#93C5FD",

  success: "#34D399",
  onSuccess: "#052e1f",
  successSubtle: "#0B2E22",
  onSuccessSubtle: "#6EE7B7",
  warning: "#FBBF24",
  onWarning: "#3a2606",
  warningSubtle: "#332108",
  onWarningSubtle: "#FCD34D",
  error: "#F87171",
  onError: "#3a0a0a",
  errorSubtle: "#3A1414",
  onErrorSubtle: "#FCA5A5",
  info: "#60A5FA",
  onInfo: "#0B1120",

  border: "#243049",
  borderStrong: "#334155",
  divider: "#1B263B",

  overlay: "rgba(0,0,0,0.6)",
  gradientStart: "#1E3A8A",
  gradientEnd: "#0B1120",
  shadow: "#000000",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  // React Native models "follow the system" as "unspecified", not null.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  // useColorScheme can also report "unspecified"; only the two real schemes count.
  const isScheme = system === "light" || system === "dark";
  const scheme: ColorScheme = isScheme && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Font family helper: falls back to system if Manrope failed to load.
export const font = {
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
  bold: "Manrope-Bold",
  extrabold: "Manrope-ExtraBold",
};
