// Answers given while offline. They are kept on device and replayed the next
// time the backend is reachable, so a session in a tunnel is not lost.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiError, api } from "@/src/lib/api";

const KEY = "zhd_pending_answers";
const MAX = 500;

export type PendingAnswer = {
  question_id: string;
  selectedKey: string;
  at: string;
};

async function read(): Promise<PendingAnswer[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function write(list: PendingAnswer[]) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage full or unavailable — nothing better to do */
  }
}

export async function enqueueAnswer(question_id: string, selectedKey: string) {
  const list = await read();
  // One entry per question: the latest answer is the one that counts.
  const next = list.filter((p) => p.question_id !== question_id);
  next.push({ question_id, selectedKey, at: new Date().toISOString() });
  await write(next);
}

export async function pendingAnswerCount(): Promise<number> {
  return (await read()).length;
}

/**
 * Replay queued answers. Stops at the first connection failure so the rest stay
 * queued; answers the server rejects (gone, over quota) are dropped rather than
 * retried forever. Returns how many were accepted.
 */
export async function flushAnswers(): Promise<number> {
  const list = await read();
  if (list.length === 0) return 0;

  const left: PendingAnswer[] = [];
  let sent = 0;

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    try {
      await api.post("/practice/answer", { question_id: p.question_id, selectedKey: p.selectedKey });
      sent++;
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      if (status === 0 || status >= 500) {
        // Still offline (or the server is down): keep this one and the rest.
        left.push(...list.slice(i));
        break;
      }
      // 4xx — the server will never accept it; drop it.
    }
  }

  await write(left);
  return sent;
}

export async function clearAnswerQueue() {
  await write([]);
}
