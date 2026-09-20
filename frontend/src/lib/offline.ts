// Offline support: a persisted react-query cache plus a tiny online/offline
// store that the API client feeds. The app is used on buses and in classrooms
// with no signal, so everything that was once fetched has to stay readable.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { useSyncExternalStore } from "react";

/** Bumped when a cached shape changes, so stale entries are dropped. */
export const CACHE_BUSTER = "v1";

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "zhd_query_cache",
  throttleTime: 2000,
});

/**
 * Queries worth keeping on disk. The live exam is deliberately absent: it is
 * owned by the server and replaying a stale copy would be wrong.
 */
const PERSISTED_KEYS = new Set([
  "categories",
  "practice",
  "stats",
  "limits",
  "review",
  "attempts",
  "attempt",
  "me",
  "question-history",
  "srs-due",
  "achievements",
]);

export function shouldPersistQueryKey(key: readonly unknown[]): boolean {
  return PERSISTED_KEYS.has(String(key[0]));
}

// ---------------------------------------------------------------------------
// Online state. No NetInfo dependency: the API client reports what it sees,
// which is the thing we actually care about — can we reach the backend.
// ---------------------------------------------------------------------------

let online = true;
const listeners = new Set<() => void>();

export function setOnline(next: boolean) {
  if (online === next) return;
  online = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function isOnline() {
  return online;
}

/** `false` while the last request to the backend failed to connect. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => online,
    () => true,
  );
}
