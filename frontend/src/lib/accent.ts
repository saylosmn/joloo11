// Accent colour choice. The palette keeps its structure — only the brand ramp
// changes — so contrast pairs (onBrandPrimary, onBrandTertiary…) stay correct
// whichever accent is picked.
import { useSyncExternalStore } from "react";

import { storage } from "@/src/utils/storage";

export type AccentKey = "blue" | "green" | "violet" | "rose" | "amber";

export type AccentRamp = {
  brand: string;
  brandPrimary: string;
  brandSecondary: string;
  brandTertiary: string;
  onBrand: string;
  onBrandPrimary: string;
  onBrandSecondary: string;
  onBrandTertiary: string;
  gradientStart: string;
  gradientEnd: string;
  info: string;
};

export const ACCENTS: Record<AccentKey, { label: string; swatch: string; light: AccentRamp; dark: AccentRamp }> = {
  blue: {
    label: "Цэнхэр",
    swatch: "#2563EB",
    light: {
      brand: "#3B82F6",
      brandPrimary: "#2563EB",
      brandSecondary: "#DBEAFE",
      brandTertiary: "#EFF6FF",
      onBrand: "#FFFFFF",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#1E40AF",
      onBrandTertiary: "#2563EB",
      gradientStart: "#2563EB",
      gradientEnd: "#1D4ED8",
      info: "#2563EB",
    },
    dark: {
      brand: "#60A5FA",
      brandPrimary: "#3B82F6",
      brandSecondary: "#1E3A8A",
      brandTertiary: "#172554",
      onBrand: "#0B1120",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#BFDBFE",
      onBrandTertiary: "#93C5FD",
      gradientStart: "#1B3A7A",
      gradientEnd: "#16264A",
      info: "#60A5FA",
    },
  },
  green: {
    label: "Ногоон",
    swatch: "#16A34A",
    light: {
      brand: "#22C55E",
      brandPrimary: "#16A34A",
      brandSecondary: "#DCFCE7",
      brandTertiary: "#F0FDF4",
      onBrand: "#FFFFFF",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#166534",
      onBrandTertiary: "#15803D",
      gradientStart: "#16A34A",
      gradientEnd: "#15803D",
      info: "#0F766E",
    },
    dark: {
      brand: "#4ADE80",
      brandPrimary: "#22C55E",
      brandSecondary: "#14532D",
      brandTertiary: "#052E16",
      onBrand: "#052E16",
      onBrandPrimary: "#052E16",
      onBrandSecondary: "#BBF7D0",
      onBrandTertiary: "#86EFAC",
      gradientStart: "#14532D",
      gradientEnd: "#0B2A1A",
      info: "#4ADE80",
    },
  },
  violet: {
    label: "Ягаан хөх",
    swatch: "#7C3AED",
    light: {
      brand: "#8B5CF6",
      brandPrimary: "#7C3AED",
      brandSecondary: "#EDE9FE",
      brandTertiary: "#F5F3FF",
      onBrand: "#FFFFFF",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#5B21B6",
      onBrandTertiary: "#6D28D9",
      gradientStart: "#7C3AED",
      gradientEnd: "#5B21B6",
      info: "#6D28D9",
    },
    dark: {
      brand: "#A78BFA",
      brandPrimary: "#8B5CF6",
      brandSecondary: "#4C1D95",
      brandTertiary: "#2E1065",
      onBrand: "#1E1B4B",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#DDD6FE",
      onBrandTertiary: "#C4B5FD",
      gradientStart: "#4C1D95",
      gradientEnd: "#241047",
      info: "#A78BFA",
    },
  },
  rose: {
    label: "Ягаан",
    swatch: "#E11D48",
    light: {
      brand: "#F43F5E",
      brandPrimary: "#E11D48",
      brandSecondary: "#FFE4E6",
      brandTertiary: "#FFF1F2",
      onBrand: "#FFFFFF",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#9F1239",
      onBrandTertiary: "#BE123C",
      gradientStart: "#E11D48",
      gradientEnd: "#9F1239",
      info: "#BE123C",
    },
    dark: {
      brand: "#FB7185",
      brandPrimary: "#F43F5E",
      brandSecondary: "#881337",
      brandTertiary: "#4C0519",
      onBrand: "#4C0519",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#FECDD3",
      onBrandTertiary: "#FDA4AF",
      gradientStart: "#881337",
      gradientEnd: "#3F0A17",
      info: "#FB7185",
    },
  },
  amber: {
    label: "Улбар шар",
    swatch: "#D97706",
    light: {
      brand: "#F59E0B",
      brandPrimary: "#D97706",
      brandSecondary: "#FEF3C7",
      brandTertiary: "#FFFBEB",
      onBrand: "#FFFFFF",
      onBrandPrimary: "#FFFFFF",
      onBrandSecondary: "#92400E",
      onBrandTertiary: "#B45309",
      gradientStart: "#D97706",
      gradientEnd: "#B45309",
      info: "#B45309",
    },
    dark: {
      brand: "#FBBF24",
      brandPrimary: "#F59E0B",
      brandSecondary: "#78350F",
      brandTertiary: "#451A03",
      onBrand: "#451A03",
      onBrandPrimary: "#451A03",
      onBrandSecondary: "#FDE68A",
      onBrandTertiary: "#FCD34D",
      gradientStart: "#78350F",
      gradientEnd: "#3B1A06",
      info: "#FBBF24",
    },
  },
};

export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];
export const DEFAULT_ACCENT: AccentKey = "blue";

const KEY = "zhd_accent";

let current: AccentKey = DEFAULT_ACCENT;
const listeners = new Set<() => void>();

export function getAccent(): AccentKey {
  return current;
}

export function setAccent(key: AccentKey) {
  if (!ACCENTS[key] || current === key) return;
  current = key;
  listeners.forEach((l) => l());
  storage.setItem(KEY, key).catch(() => {});
}

/** Load the saved accent once at startup. */
export async function initAccent() {
  const saved = (await storage.getItem<string>(KEY, DEFAULT_ACCENT)) as AccentKey | null;
  if (saved && ACCENTS[saved] && saved !== current) {
    current = saved;
    listeners.forEach((l) => l());
  }
}

export function useAccent(): AccentKey {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
    () => DEFAULT_ACCENT,
  );
}
