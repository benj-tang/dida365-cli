import { NetworkError, ApiError } from "./errors.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpClientOptions {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
  retries?: number;
}

export class HttpClient {
  baseUrl: string;
  token?: string;
  timeoutMs: number;
  retries: number;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.token = opts.token;
    this.timeoutMs = opts.timeoutMs ?? 10000;
    this.retries = opts.retries ?? 2;
  }

  async request<T>(method: HttpMethod, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    if (!this.baseUrl || this.baseUrl.startsWith("TODO")) {
      throw new NetworkError("HTTP endpoint not configured. Set baseUrl in config.");
    }

    const url = new URL(path, this.baseUrl);
    const requestHeaders: Record<string, string> = { ...headers };
    if (this.token) requestHeaders["authorization"] = `Bearer ${this.token}`;
    if (body !== undefined) requestHeaders["content-type"] = "application/json";

    const init: RequestInit = {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined
    };

    const res = await fetchWithRetry(url.toString(), init, this.timeoutMs, this.retries);
    const text = await res.text();
    if (!text) {
      // Return empty object cast to T for empty responses
      return {} as T;
    }

    const contentType = res.headers.get("content-type") ?? "";

    // Handle JSON responses
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError("Invalid JSON response from API", res.status, path, text.substring(0, 500));
      }
    }

    // Handle non-JSON responses
    if (res.ok) {
      // Success but non-JSON - return as-is (some APIs do this)
      // Use type assertion only for string-returning endpoints
      return text as T;
    }

    // Error response
    throw new ApiError(`API returned HTTP ${res.status}`, res.status, path, text.substring(0, 500));
  }
}

async function fetchWithRetry(url: string, init: RequestInit, timeoutMs: number, retries: number): Promise<Response> {
  let lastErr: unknown;
  // Cap retries to prevent excessive waiting
  const maxRetries = Math.min(retries, 5);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (!res.ok) {
        // Don't retry on client errors (4xx)
        if (res.status >= 400 && res.status < 500) {
          throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status);
        }
        // Retry on server errors (5xx)
        if (res.status >= 500 && attempt < maxRetries) {
          await backoff(attempt);
          continue;
        }
        throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (err instanceof ApiError && err.statusCode && err.statusCode < 500) {
        throw err; // Don't retry client errors
      }
      if (attempt < maxRetries) {
        await backoff(attempt);
        continue;
      }
      if (err instanceof NetworkError || err instanceof ApiError) throw err;
      // Safely extract error message from unknown error
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new NetworkError("Network request failed", new Error(errorMessage));
    }
  }
  // If we exit the loop without returning, all retries failed
  if (lastErr instanceof NetworkError || lastErr instanceof ApiError) {
    throw lastErr;
  }
  if (lastErr instanceof Error) {
    throw new NetworkError("Network request failed after retries", lastErr);
  }
  throw new NetworkError("Network request failed after retries", new Error(String(lastErr)));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function backoff(attempt: number) {
  const delay = Math.min(200 * Math.pow(2, attempt), 5000); // Cap at 5 seconds
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export interface DidaDateTime {
  localDateTime: string;
}

export interface TaskItem {
  id?: string;
  title?: string;
  status?: number;
  sortOrder?: number;
  startDate?: string;
  isAllDay?: boolean;
  completedTime?: string;
}

export interface TaskDraft {
  title?: string;
  content?: string;
  desc?: string;
  isAllDay?: boolean;
  startDate?: string;
  dueDate?: string;
  reminders?: string[];
  repeatFlag?: string;
  priority?: number;
  sortOrder?: number;
  timeZone?: string;
  tags?: string[];
  items?: TaskItem[];
}
