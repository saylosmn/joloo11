// Whether the intro has been seen. Stored on device, so it shows once per
// install rather than once per login.
import { storage } from "@/src/utils/storage";

const KEY = "zhd_onboarded";

export async function isOnboarded(): Promise<boolean> {
  return (await storage.getItem<boolean>(KEY, false)) ?? false;
}

export async function setOnboarded(): Promise<void> {
  await storage.setItem(KEY, true);
}
