// Design tokens — calm Slate Blue, light + dark. Keys match design_guidelines.json.
// Use makeStyles() for stylesheets and useTheme().colors for color props.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

import { ACCENTS, useAccent } from "@/src/lib/accent";

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

  // Elevation surfaces. In light mode depth comes from shadows, so these stay
  // white; in dark mode shadows are invisible, so depth comes from lightness.
  elev1: "#FFFFFF",
  elev2: "#FFFFFF",
  elev3: "#FFFFFF",
  skeleton: "#E9EEF5",
  skeletonHighlight: "#F6F9FC",
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
  gradientStart: "#1B3A7A",
  gradientEnd: "#16264A",
  shadow: "#000000",

  elev1: "#141E33",
  elev2: "#18243C",
  elev3: "#1E2C48",
  skeleton: "#1A2438",
  skeletonHighlight: "#25324B",
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
  const accent = useAccent();
  // useColorScheme can also report "unspecified"; only the two real schemes count.
  const isScheme = system === "light" || system === "dark";
  const scheme: ColorScheme = isScheme && themes[system] ? system : defaultScheme;

  return useMemo(() => {
    const base = themes[scheme] ?? themes.light;
    // Only the brand ramp is swapped, so every contrast pair stays intentional.
    const ramp = ACCENTS[accent]?.[scheme] ?? ACCENTS.blue[scheme];
    return { scheme, colors: { ...base, ...ramp } };
  }, [scheme, accent]);
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

// ---------------------------------------------------------------------------
// Layout tokens. Screens used to hand-write 20/18/16 everywhere; these keep the
// rhythm consistent and match design_guidelines.json.
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Standard screen side gutter. */
  gutter: 20,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;

/** Type scale. `display`/`hero` are new — they give headers real hierarchy. */
export const type = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
  display: 32,
  hero: 44,
} as const;

/** Motion durations — one place, so animations feel like one system. */
export const duration = {
  instant: 120,
  fast: 180,
  base: 280,
  slow: 450,
  celebrate: 900,
} as const;

/**
 * Motion presets. These are timing curves rather than springs on purpose:
 * Reanimated's web runtime settles springs before they reach their target, so a
 * spring-driven value could stop short and stay there.
 */
export const motion = {
  /** Settling movement — progress, rings, sheets. */
  soft: { duration: 320 },
  /** Quick reaction to a touch. */
  snappy: { duration: 140 },
  /** Small overshoot, for feedback that should feel alive. */
  bouncy: { duration: 320 },
} as const;

/**
 * Depth for a surface. Light mode uses shadows; dark mode uses a lighter
 * surface plus a hairline border, because shadows read as nothing on black.
 */
export function elevationStyle(colors: ThemeColors, scheme: ColorScheme, level: 0 | 1 | 2 | 3 = 1) {
  if (level === 0) {
    return { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border };
  }
  const dark = scheme === "dark";
  const bg = level === 1 ? colors.elev1 : level === 2 ? colors.elev2 : colors.elev3;
  if (dark) {
    return {
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: level >= 2 ? colors.borderStrong : colors.border,
    };
  }
  const shadow = [
    { opacity: 0.05, radius: 8, offset: 3, elevation: 1 },
    { opacity: 0.06, radius: 10, offset: 4, elevation: 2 },
    { opacity: 0.1, radius: 18, offset: 8, elevation: 5 },
  ][level - 1];
  return {
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: shadow.opacity,
    shadowRadius: shadow.radius,
    shadowOffset: { width: 0, height: shadow.offset },
    elevation: shadow.elevation,
  };
}

/** Hook form of {@link elevationStyle}. */
export function useElevation(level: 0 | 1 | 2 | 3 = 1) {
  const { colors, scheme } = useTheme();
  return useMemo(() => elevationStyle(colors, scheme, level), [colors, scheme, level]);
}
