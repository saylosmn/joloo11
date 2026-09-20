// Reduce-motion support.
//
// Two sources feed one flag: the OS accessibility setting and an in-app switch
// (some people want calmer animations without turning the system setting on).
// Components read it through useReducedMotion() and skip decorative movement —
// colour and layout stay exactly the same, so nothing becomes unclear.
import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

import { storage } from "@/src/utils/storage";

const KEY = "zhd_reduce_motion";

let systemReduced = false;
let userReduced = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function snapshot() {
  return systemReduced || userReduced;
}

/** True when decorative animation should be skipped. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export function isReducedMotion() {
  return snapshot();
}

export async function getReduceMotionPreference(): Promise<boolean> {
  return (await storage.getItem<boolean>(KEY, false)) ?? false;
}

export async function setReduceMotionPreference(value: boolean) {
  userReduced = value;
  await storage.setItem(KEY, value);
  emit();
}

/**
 * Read both sources once at startup and keep watching the system one.
 * Returns the unsubscribe function.
 */
export function initMotionPreferences(): () => void {
  let sub: { remove: () => void } | null = null;

  AccessibilityInfo.isReduceMotionEnabled?.()
    .then((v) => {
      systemReduced = !!v;
      emit();
    })
    .catch(() => {});

  getReduceMotionPreference()
    .then((v) => {
      userReduced = v;
      emit();
    })
    .catch(() => {});

  try {
    sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v: boolean) => {
      systemReduced = !!v;
      emit();
    });
  } catch {
    sub = null;
  }

  return () => sub?.remove();
}
