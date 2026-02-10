import type { AppError } from "./errors.js";

export const ExitCode = {
  OK: 0,
  UNKNOWN: 1,
  VALIDATION: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  NETWORK: 5,
  NOT_IMPLEMENTED: 6
} as const;

export function exitCodeForError(err: AppError): number {
  switch (err.type) {
    case "ValidationError":
      return ExitCode.VALIDATION;
    case "AuthError":
      return ExitCode.AUTH;
    case "NotFoundError":
      return ExitCode.NOT_FOUND;
    case "NetworkError":
      return ExitCode.NETWORK;
    case "NotImplementedError":
      return ExitCode.NOT_IMPLEMENTED;
    default:
      return ExitCode.UNKNOWN;
  }
}
