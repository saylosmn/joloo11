// On-device practice helpers: resume position per category, daily goal, and
// the last practiced category (for the "continue" shortcut on Home).
// All values are scalars so they round-trip through the storage singleton.
import { storage } from "@/src/utils/storage";

const resumeKey = (cat: string) => `zhd_resume_${cat}`;
const GOAL_KEY = "zhd_daily_goal";
const LAST_CAT_KEY = "zhd_last_cat";

export const DEFAULT_DAILY_GOAL = 20;

export async function getResume(cat: string): Promise<number> {
  return (await storage.getItem<number>(resumeKey(cat), 0)) ?? 0;
}
export async function setResume(cat: string, idx: number): Promise<void> {
  await storage.setItem(resumeKey(cat), idx);
}
export async function clearResume(cat: string): Promise<void> {
  await storage.removeItem(resumeKey(cat));
}

export async function getDailyGoal(): Promise<number> {
  return (await storage.getItem<number>(GOAL_KEY, DEFAULT_DAILY_GOAL)) ?? DEFAULT_DAILY_GOAL;
}
export async function setDailyGoal(n: number): Promise<void> {
  await storage.setItem(GOAL_KEY, n);
}

export async function getLastCategory(): Promise<string> {
  return (await storage.getItem<string>(LAST_CAT_KEY, "")) ?? "";
}
export async function setLastCategory(cat: string): Promise<void> {
  await storage.setItem(LAST_CAT_KEY, cat);
}
