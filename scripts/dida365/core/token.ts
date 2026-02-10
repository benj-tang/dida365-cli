import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number; // seconds
  expires_at?: number; // epoch ms
}

export function defaultTokenPath() {
  return path.join(os.homedir(), ".config", "dida365-cli", "token.json");
}

export function resolveTokenPath(cfg: any): string {
  const fromCfg = cfg?.oauth?.tokenPath ?? cfg?.tokenPath ?? "";
  return String(fromCfg || defaultTokenPath());
}

export function normalizeToken(token: OAuthToken): OAuthToken {
  const t = { ...token };
  if (!t.expires_at && t.expires_in) {
    t.expires_at = Date.now() + t.expires_in * 1000;
  }
  return t;
}

export function isTokenExpired(token: OAuthToken, skewSec = 60): boolean {
  if (!token?.expires_at) return false;
  return Date.now() >= token.expires_at - skewSec * 1000;
}

async function atomicWriteJson(filePath: string, obj: any) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });

  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}.json`);
  const raw = JSON.stringify(obj, null, 2);

  const fh = await fs.open(tmp, "w", 0o600);
  try {
    await fh.writeFile(raw, "utf8");
    await fh.sync();
  } finally {
    await fh.close();
  }

  await fs.rename(tmp, filePath);
  await fs.chmod(filePath, 0o600).catch(() => undefined);
}

function validateToken(data: any): OAuthToken {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid token: not an object");
  }
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("Invalid token: missing or invalid access_token");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    scope: data.scope,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : undefined,
    expires_at: typeof data.expires_at === "number" ? data.expires_at : undefined,
    ...data, // Preserve any additional fields
  };
}

export async function loadToken(tokenPath: string): Promise<OAuthToken | null> {
  try {
    const raw = await fs.readFile(tokenPath, "utf8");
    const parsed = JSON.parse(raw);
    return validateToken(parsed);
  } catch (e: any) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
}

export async function saveToken(tokenPath: string, token: OAuthToken): Promise<OAuthToken> {
  const normalized = normalizeToken(token);
  await atomicWriteJson(tokenPath, normalized);
  return normalized;
}

export async function clearToken(tokenPath: string): Promise<void> {
  try {
    await fs.unlink(tokenPath);
  } catch (e: any) {
    if (e?.code !== "ENOENT") throw e;
  }
}

// In-process refresh mutex (avoid concurrent refresh overwriting tokens)
let refreshPromise: Promise<any> | null = null;
export async function withRefreshMutex<T>(fn: () => Promise<T>): Promise<T> {
  if (refreshPromise) return refreshPromise as Promise<T>;
  const p = fn();
  refreshPromise = p as any;
  try {
    return await p;
  } finally {
    refreshPromise = null;
  }
}
