import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

interface CacheEntry<T = any> {
  key: string;
  value: T;
  cachedAt: number;
  expiresAt: number;
}

function isCacheEntry<T>(value: unknown): value is CacheEntry<T> {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.key === "string" &&
    "value" in obj &&
    typeof obj.cachedAt === "number" &&
    typeof obj.expiresAt === "number"
  );
}

export class Cache {
  private mem = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<unknown>>();

  constructor(private opts: { dir: string; ttlMs: number; staleIfErrorMs: number }) {}

  private fileForKey(key: string) {
    const hash = createHash("sha1").update(key).digest("hex");
    return path.join(this.opts.dir, `${hash}.json`);
  }

  private async readDisk<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const file = this.fileForKey(key);
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      if (!isCacheEntry<T>(parsed)) {
        return undefined;
      }
      if (parsed.key !== key) return undefined;
      return parsed;
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") {
        return undefined;
      }
      throw err;
    }
  }

  async get<T>(key: string): Promise<{ entry?: CacheEntry<T>; stale: boolean; source: "memory" | "disk" | null }> {
    const now = Date.now();
    const memEntry = this.mem.get(key) as CacheEntry<T> | undefined;
    if (memEntry) {
      const stale = now > memEntry.expiresAt;
      return { entry: memEntry, stale, source: "memory" };
    }

    try {
      const diskEntry = await this.readDisk<T>(key);
      if (diskEntry) {
        this.mem.set(key, diskEntry);
        const stale = now > diskEntry.expiresAt;
        return { entry: diskEntry, stale, source: "disk" };
      }
    } catch {
      // Disk read failed (permission error, etc.), continue with null
    }

    return { stale: false, source: null };
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      cachedAt: now,
      expiresAt: now + (ttlMs ?? this.opts.ttlMs)
    };

    await fs.mkdir(this.opts.dir, { recursive: true });
    await fs.writeFile(this.fileForKey(key), JSON.stringify(entry), "utf8");
    this.mem.set(key, entry);
  }

  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttlMs?: number; staleIfErrorMs?: number }
  ): Promise<{ value: T; source: "cache" | "origin"; stale: boolean; cachedAt?: number; error?: unknown }> {
    const ttlMs = options?.ttlMs ?? this.opts.ttlMs;
    const staleIfErrorMs = options?.staleIfErrorMs ?? this.opts.staleIfErrorMs;
    const now = Date.now();

    const { entry, stale } = await this.get<T>(key);
    if (entry && !stale) {
      return { value: entry.value, source: "cache", stale: false, cachedAt: entry.cachedAt };
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      const value = await existing as T;
      return { value, source: "origin", stale: false };
    }

    const promise = (async () => {
      try {
        const value = await fetcher();
        await this.set(key, value, ttlMs);
        return value;
      } catch (err) {
        if (entry) {
          const staleAge = now - entry.expiresAt;
          if (staleAge <= staleIfErrorMs) {
            return { value: entry.value, source: "cache", stale: true, cachedAt: entry.cachedAt, error: err };
          }
        }
        throw err;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);

    const result = await promise;
    
    if (result && typeof result === "object" && "source" in result && result.source === "cache") {
      return result as { value: T; source: "cache"; stale: true; cachedAt: number; error: unknown };
    }
    
    return { value: result as T, source: "origin", stale: false };
  }

  async invalidate(key: string): Promise<void> {
    this.mem.delete(key);
    try {
      await fs.unlink(this.fileForKey(key));
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  async purge(): Promise<void> {
    this.mem.clear();
    await fs.rm(this.opts.dir, { recursive: true, force: true });
  }

  async stats(): Promise<{
    dir: string;
    files: number;
    memoryEntries: number;
    ttlMs: number;
    staleIfErrorMs: number;
  }> {
    let files = 0;
    try {
      const list = await fs.readdir(this.opts.dir);
      files = list.length;
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
        throw err;
      }
    }
    return {
      dir: this.opts.dir,
      files,
      memoryEntries: this.mem.size,
      ttlMs: this.opts.ttlMs,
      staleIfErrorMs: this.opts.staleIfErrorMs
    };
  }
}
