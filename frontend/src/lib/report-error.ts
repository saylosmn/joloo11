// Crash reporting without a third-party SDK: the app posts to our own backend,
// which keeps reports for 30 days. Reporting must never itself throw, and must
// never block the UI.
import Constants from "expo-constants";
import { Platform } from "react-native";

import { api } from "@/src/lib/api";
import { isOnline } from "@/src/lib/offline";

/** Same message twice in a row is almost always the same crash looping. */
let lastKey = "";
let lastAt = 0;

export type ErrorContext = { screen?: string; fatal?: boolean };

export function reportError(error: unknown, ctx: ErrorContext = {}) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${ctx.screen ?? ""}:${err.message}`;
    const now = Date.now();
    // Drop repeats within a minute so a render loop cannot spam the backend.
    if (key === lastKey && now - lastAt < 60_000) return;
    lastKey = key;
    lastAt = now;

    if (!isOnline()) return;

    api
      .post("/client-error", {
        message: err.message,
        stack: err.stack ?? "",
        screen: ctx.screen ?? "",
        fatal: !!ctx.fatal,
        platform: `${Platform.OS} ${Platform.Version}`,
        appVersion: Constants.expoConfig?.version ?? "",
      })
      .catch(() => {});
  } catch {
    /* reporting must never break anything */
  }
}

/**
 * Catch errors that escape React: async rejections, native event handlers.
 * Called once at startup.
 */
export function installGlobalErrorHandler() {
  try {
    const g = globalThis as any;
    const utils = g.ErrorUtils;
    if (!utils?.getGlobalHandler) return;
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error: any, isFatal?: boolean) => {
      reportError(error, { fatal: !!isFatal, screen: "global" });
      previous?.(error, isFatal);
    });
  } catch {
    /* not available on this platform */
  }
}
