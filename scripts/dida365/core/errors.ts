/**
 * Dida365 Custom Errors
 */

// AppError type for exit code mapping
export type AppError = Dida365Error | ValidationError | NotFoundError | NetworkError | ApiError | NotImplementedError;

// Normalize any error to AppError
export function normalizeError(err: unknown): AppError {
  if (err instanceof Dida365Error) {
    return err;
  }
  if (err instanceof Error) {
    return new NetworkError(err.message, err);
  }
  return new Dida365Error(String(err), "UNKNOWN_ERROR");
}

export class Dida365Error extends Error {
  type?: string;
  details?: unknown;
  
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "Dida365Error";
    this.type = this.constructor.name; // For exitCodeForError compatibility
  }
}

export class ValidationError extends Dida365Error {
  field?: string;
  
  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR", 400, field);
    this.name = "ValidationError";
    this.type = "ValidationError";
    this.field = field;
  }
}

export class NotFoundError extends Dida365Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404, `${resource}/${id}`);
    this.name = "NotFoundError";
    this.type = "NotFoundError";
  }
}

export class NetworkError extends Dida365Error {
  constructor(message: string, cause?: Error) {
    super(message, "NETWORK_ERROR", undefined, undefined, cause);
    this.name = "NetworkError";
    this.type = "NetworkError";
  }
}

export class ApiError extends Dida365Error {
  constructor(message: string, statusCode: number, path?: string, body?: unknown) {
    super(`API returned HTTP ${statusCode}: ${message}`, "API_ERROR", statusCode, path, undefined);
    this.name = "ApiError";
    this.type = "ApiError";
    // Don't expose full body in production for security
    if (process.env.NODE_ENV === "development" && body) {
      (this as any).details = body;
    }
  }
}

export class NotImplementedError extends Dida365Error {
  constructor(message: string = "Not implemented") {
    super(message, "NOT_IMPLEMENTED", 501);
    this.name = "NotImplementedError";
    this.type = "NotImplementedError";
  }
}
