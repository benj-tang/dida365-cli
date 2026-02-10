export function toArray<T>(value?: T | T[]): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function uniq(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const trimmed = typeof v === "string" ? v.trim() : String(v ?? "");
    if (!trimmed) continue;
    set.add(trimmed);
  }
  return Array.from(set);
}

export function pickDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) out[key as keyof T] = val as any;
  }
  return out;
}

export function parseJsonValue(raw: string): any {
  const s = String(raw);
  // allow passing JSON literals (strings must be quoted)
  try {
    return JSON.parse(s);
  } catch {
    // fallback: treat as plain string
    return s;
  }
}

export function setByDottedPath(obj: any, dottedPath: string, value: any) {
  const parts = dottedPath.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return obj;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}
