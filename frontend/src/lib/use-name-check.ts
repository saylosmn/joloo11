import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api } from "@/src/lib/api";

export type NameStatus = { valid: boolean; available: boolean; reason?: string };

const DEBOUNCE_MS = 450;

/**
 * Debounced availability check for a profile name.
 *
 * Debouncing happens in the change handler rather than an effect, and the answer
 * is cached against the exact name it was asked about — so a slow earlier reply
 * can no longer land on top of a newer one, which the previous hand-rolled
 * version allowed.
 */
export function useNameCheck(current?: string) {
  const [name, setName] = useState(current ?? "");
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChangeName = (raw: string) => {
    const next = raw.replace(/\s/g, "");
    setName(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery(next), DEBOUNCE_MS);
  };

  const wanted = name.length > 0 && name !== current;
  const asked = query.length > 0 && query !== current;

  const check = useQuery<NameStatus>({
    queryKey: ["check-name", query],
    queryFn: () => api.get(`/profile/check-name?name=${encodeURIComponent(query)}`),
    enabled: asked,
    retry: false,
    staleTime: 30_000,
  });

  // Only show an answer once it is for exactly what is typed right now.
  const settled = asked && query === name && !check.isFetching;
  return {
    name,
    setName: onChangeName,
    status: settled ? (check.data ?? null) : null,
    checking: wanted && !settled,
  };
}
