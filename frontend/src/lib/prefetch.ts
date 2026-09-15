import { Image } from "expo-image";

import { imageUrl } from "@/src/lib/api";

/** How many questions ahead to warm the image cache for. */
const AHEAD = 3;

type WithImage = { imageUrl?: string | null };

/**
 * Warm the next few question images so moving forward does not wait on the
 * network. Failures are ignored on purpose: this is only an optimisation.
 */
export function prefetchAhead(questions: WithImage[], from: number) {
  const urls = questions
    .slice(from + 1, from + 1 + AHEAD)
    .map((q) => imageUrl(q.imageUrl))
    .filter((u): u is string => !!u);
  if (urls.length) Image.prefetch(urls).catch(() => {});
}
