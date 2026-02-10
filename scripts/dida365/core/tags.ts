import type { TaskDraft } from "../types/task.js";

export function normalizeTagValue(tag: string): string {
  return tag.trim().replace(/\s+/g, "").toLowerCase();
}

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeTagValue(tag);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function ensureTagsOnTaskDraft(
  draft: TaskDraft,
  opts: { requiredTags?: string[]; tagHints?: string[]; enableRequiredTags?: boolean }
) {
  const enableRequiredTags = opts.enableRequiredTags ?? true;
  const required = enableRequiredTags ? dedupeTags(opts.requiredTags ?? ["cli"]) : [];

  const tagHints = opts.tagHints ?? [];
  const agentTags = dedupeTags(tagHints).filter((t) => !required.includes(t));
  const merged = [...required, ...agentTags];

  if (merged.length) {
    draft.tags = merged;
  } else {
    delete (draft as any).tags;
  }
  return draft;
}
