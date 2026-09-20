// Local study reminders. No server and no push tokens involved: everything is
// scheduled on the device, so it also works for users who never grant a push
// token and keeps working offline.
//
// Reminders are re-armed every time the app opens, which lets us skip days the
// goal is already met and keeps the "we miss you" nudge from firing while the
// app is in daily use.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const ENABLED_KEY = "zhd_notify_enabled";
const HOUR_KEY = "zhd_notify_hour";
const CHANNEL = "study-reminders";

export const DEFAULT_REMINDER_HOUR = 20;
export const REMINDER_HOURS = [12, 18, 20, 21];

/** How many days ahead the daily reminder is scheduled in one go. */
const DAYS_AHEAD = 7;
/** Days of silence before the come-back nudge fires. */
const COMEBACK_DAYS = 3;

export type ReminderSettings = { enabled: boolean; hour: number };

export async function getReminderSettings(): Promise<ReminderSettings> {
  const enabled = (await storage.getItem<boolean>(ENABLED_KEY, false)) ?? false;
  const hour = (await storage.getItem<number>(HOUR_KEY, DEFAULT_REMINDER_HOUR)) ?? DEFAULT_REMINDER_HOUR;
  return { enabled, hour };
}

export async function saveReminderSettings(s: ReminderSettings) {
  await storage.setItem(ENABLED_KEY, s.enabled);
  await storage.setItem(HOUR_KEY, s.hour);
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Сургалтын сануулга",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Asks for permission. Returns false if the user declined or on web. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch {
    return false;
  }
}

function at(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function schedule(date: Date, title: string, body: string, id: string) {
  if (date.getTime() <= Date.now() + 30_000) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { id },
      ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}),
    },
  });
}

export type ReminderContext = {
  /** Questions answered today, so today's nudge can be skipped once the goal is met. */
  answeredToday: number;
  dailyGoal: number;
  /** Current streak — a streak at risk gets its own, more urgent reminder. */
  streak: number;
};

/**
 * Wipe and re-arm every local reminder:
 *  - a daily nudge at the chosen hour for the next week (today is skipped when
 *    the goal is already met),
 *  - a streak-at-risk reminder tonight when a streak exists and today is empty,
 *  - a come-back nudge if the app is not opened for a few days.
 */
export async function rescheduleReminders(ctx: ReminderContext): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { enabled, hour } = await getReminderSettings();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;

    const granted = await Notifications.getPermissionsAsync();
    if (!granted.granted) return;

    await ensureChannel();

    const goalMet = ctx.dailyGoal > 0 && ctx.answeredToday >= ctx.dailyGoal;
    const remaining = Math.max(0, ctx.dailyGoal - ctx.answeredToday);

    for (let d = 0; d < DAYS_AHEAD; d++) {
      if (d === 0 && goalMet) continue;
      const body =
        d === 0 && ctx.answeredToday > 0
          ? `Өнөөдрийн зорилгод ${remaining} асуулт дутуу байна.`
          : "Өнөөдрийн асуултаа хийчихье — 5 минут л болно.";
      await schedule(at(d, hour), "ЗХД Шалгалт", body, `daily-${d}`);
    }

    // Streak about to break: one firmer nudge later in the evening.
    if (ctx.streak > 0 && ctx.answeredToday === 0) {
      const guard = at(0, Math.max(hour + 1, 21));
      await schedule(
        guard,
        `🔥 ${ctx.streak} өдрийн streak эрсдэлд`,
        "Өнөөдөр нэг ч асуулт хийгээгүй байна. Хэдхэн асуулт хийж streak-ээ хад.",
        "streak",
      );
    }

    // Silence for a few days — a single re-engagement nudge.
    await schedule(
      at(COMEBACK_DAYS, hour),
      "Шалгалтдаа бэлдсээр байна уу?",
      "Хаанаас нь орхисноо мартчихаагүй байхад үргэлжлүүлээрэй.",
      "comeback",
    );
  } catch {
    // Reminders are a nicety — never let them break the app.
  }
}

export async function cancelAllReminders() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* ignore */
  }
}

/** Foreground presentation: show the banner instead of swallowing it. */
export function configureNotificationHandler() {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
