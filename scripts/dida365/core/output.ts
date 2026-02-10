import type { OutputError, OutputSuccess } from "../types/output.js";
import { normalizeError } from "./errors.js";
import { exitCodeForError, ExitCode } from "./exitCodes.js";

function print(ctx: { json?: boolean }, payload: any) {
  if (payload == null) {
    process.stdout.write((ctx.json ? "null" : "null") + "\n");
    return;
  }
  
  const seen = new WeakSet();
  const pretty = ctx.json ? 0 : 2;
  process.stdout.write(JSON.stringify(payload, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  }, pretty) + "\n");
}

export function outputSuccess(ctx: { json?: boolean }, data: any, warnings?: string[], meta?: any) {
  const payload: OutputSuccess = { ok: true, data };
  if (warnings && warnings.length) payload.warnings = warnings;
  if (meta !== undefined) payload.meta = meta;
  print(ctx, payload);
  process.exitCode = ExitCode.OK;
}

export function outputError(ctx: { json?: boolean }, err: unknown) {
  const appErr = normalizeError(err);
  const payload: OutputError = {
    ok: false,
    error: {
      type: appErr.type ?? "UnknownError",
      code: appErr.code,
      message: appErr.message,
      details: appErr.details
    }
  };
  print(ctx, payload);
  process.exitCode = exitCodeForError(appErr);
}
