// "Save for offline": pulls every unlocked category's questions into the
// persisted query cache and warms the image cache, so the whole app works with
// no signal afterwards.
import { Image } from "expo-image";

import { api, imageUrl } from "@/src/lib/api";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

const LAST_KEY = "zhd_offline_saved_at";
/** Images are warmed in small batches so a slow phone is not flooded. */
const IMAGE_BATCH = 8;

export type DownloadProgress = {
  phase: "categories" | "questions" | "images" | "done";
  done: number;
  total: number;
};

type Cat = { category_id: string; name: string; locked?: boolean };
type Q = { imageUrl?: string | null };

export async function getLastOfflineSave(): Promise<string> {
  return (await storage.getItem<string>(LAST_KEY, "")) ?? "";
}

/**
 * Download everything the practice screens need. Uses the same query keys the
 * screens use, so the data is served straight from cache afterwards.
 */
export async function downloadForOffline(
  onProgress: (p: DownloadProgress) => void,
): Promise<{ categories: number; questions: number; images: number }> {
  onProgress({ phase: "categories", done: 0, total: 1 });

  const cats = await queryClient.fetchQuery<Cat[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories"),
  });
  const open = (cats || []).filter((c) => !c.locked);

  const urls: string[] = [];
  let questions = 0;

  for (let i = 0; i < open.length; i++) {
    const c = open[i];
    onProgress({ phase: "questions", done: i, total: open.length });
    try {
      const qs = await queryClient.fetchQuery<Q[]>({
        queryKey: ["practice", c.category_id],
        queryFn: () => api.get(`/categories/${c.category_id}/questions`),
        staleTime: 60 * 60 * 1000,
      });
      questions += qs?.length ?? 0;
      for (const q of qs || []) {
        const u = imageUrl(q.imageUrl);
        if (u) urls.push(u);
      }
    } catch {
      // One category failing (quota, network blip) should not abort the rest.
    }
  }

  const unique = Array.from(new Set(urls));
  for (let i = 0; i < unique.length; i += IMAGE_BATCH) {
    onProgress({ phase: "images", done: i, total: unique.length });
    await Image.prefetch(unique.slice(i, i + IMAGE_BATCH), { cachePolicy: "disk" }).catch(() => {});
  }

  onProgress({ phase: "done", done: unique.length, total: unique.length });
  await storage.setItem(LAST_KEY, new Date().toISOString());

  return { categories: open.length, questions, images: unique.length };
}
