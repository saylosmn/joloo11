// Over-the-air updates.
//
// expo-updates was already a dependency and app.json already points at an
// update URL, but nothing ever checked for one, so published JS updates only
// arrived when someone happened to cold-start the app at the right moment.
//
// The check runs quietly in the background; the UI only appears once an update
// is downloaded and ready, and applying it is always the user's choice — we
// never reload the app under someone mid-exam.
import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/** Do not hammer the update server every time the app is focused. */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let lastCheck = 0;
let downloaded = false;

async function checkOnce(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  if (downloaded) return true;
  if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return false;
  lastCheck = Date.now();

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    downloaded = true;
    return true;
  } catch {
    // Offline, or the update server is unreachable — try again later.
    return false;
  }
}

/**
 * Returns whether a new version is downloaded and ready, plus a function that
 * restarts into it.
 */
export function useAppUpdate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = () => {
      checkOnce()
        .then((ok) => {
          if (alive && ok) setReady(true);
        })
        .catch(() => {});
    };

    run();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") run();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const apply = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      /* the next cold start will pick it up anyway */
    }
  }, []);

  return { ready, apply };
}
