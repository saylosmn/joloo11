// Lightweight API client. Holds the session token in memory + secure storage.
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "zhd_session_token";

let inMemoryToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const t = await storage.secureGet<string | null>(TOKEN_KEY, null);
  inMemoryToken = t ?? null;
  return inMemoryToken;
}

export async function setToken(token: string) {
  inMemoryToken = token;
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  inMemoryToken = null;
  await storage.secureRemove(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await loadToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || "Алдаа гарлаа";
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Алдаа гарлаа");
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => apiFetch<T>(p),
  post: <T = any>(p: string, body?: any) =>
    apiFetch<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};

export function imageUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${BASE}${path}`;
}
