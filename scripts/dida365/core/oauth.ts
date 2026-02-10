import http from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { URL, URLSearchParams } from "node:url";
import { createInterface } from "node:readline/promises";
import open from "open";
import type { OAuthToken } from "./token.js";
import { normalizeToken } from "./token.js";

// Constants for validation
const ALLOWED_REDIRECT_HOSTS = ["localhost", "127.0.0.1", "::1"];
const TOKEN_TIMEOUT_MS = 30_000; // 30 seconds timeout for token requests

export type OAuthConfig = {
  clientId: string;
  clientSecret?: string;

  // Dida365/TickTick typically uses https://dida365.com/oauth/authorize + /oauth/token
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope?: string;

  openBrowser?: boolean;
  callbackTimeoutMs?: number;
};

// Validation functions
function isHttpsUrl(url: string, name: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS: ${url}`);
  }
}

function isValidRedirectUri(uri: string): void {
  const parsed = new URL(uri);
  if (!ALLOWED_REDIRECT_HOSTS.includes(parsed.hostname)) {
    throw new Error(`Invalid redirect_uri: ${uri}. Must be localhost or whitelisted.`);
  }
}

function validateTokenResponse(data: unknown, response: Response): OAuthToken {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid token response: expected object");
  }
  
  const tokenData = data as Record<string, unknown>;
  
  // Check for access_token or required fields
  if (!("access_token" in tokenData) || typeof tokenData.access_token !== "string") {
    throw new Error("Invalid token response: missing or invalid access_token");
  }
  
  // Return validated and normalized token
  return normalizeToken(tokenData as unknown as OAuthToken);
}

function sanitizeError(message: string, includeStatus = true): string {
  // Remove any potential sensitive information from error messages
  const sanitized = message
    .replace(/client_secret[=:]\s*\S+/gi, "client_secret=[REDACTED]")
    .replace(/access_token[=:]\s*\S+/gi, "access_token=[REDACTED]")
    .replace(/refresh_token[=:]\s*\S+/gi, "refresh_token=[REDACTED]")
    .replace(/code[=:]\s*\S+/gi, "code=[REDACTED]");
  
  if (!includeStatus) {
    return sanitized;
  }
  
  return sanitized;
}

async function safeFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${TOKEN_TIMEOUT_MS}ms`);
    }
    throw new Error(`Network error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createPkcePair() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge, method: "S256" as const };
}

export function randomState(len = 16) {
  return b64url(randomBytes(len));
}

export function buildAuthorizeUrl(cfg: OAuthConfig, state: string, codeChallenge: string) {
  // Validate URLs before use
  isHttpsUrl(cfg.authorizeUrl, "authorizeUrl");
  isValidRedirectUri(cfg.redirectUri);
  
  const url = new URL(cfg.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scope ?? "",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  }).toString();
  return url.toString();
}

export async function waitForCallback(
  redirectUri: string,
  expectedState: string,
  timeoutMs = 120_000,
  listenHost?: string
) {
  // Validate redirect URI before setting up server
  isValidRedirectUri(redirectUri);
  
  const u = new URL(redirectUri);
  // Use explicit listenHost if provided, otherwise fall back to redirectUri hostname
  const hostname = listenHost || u.hostname || "127.0.0.1";
  const port = Number(u.port || 80);
  const pathname = u.pathname || "/";

  return new Promise<{ code: string; state?: string }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        if (!req.url) return;
        const reqUrl = new URL(req.url, redirectUri);
        if (reqUrl.pathname !== pathname) {
          res.statusCode = 404;
          res.end("Not Found");
          return;
        }
        const code = reqUrl.searchParams.get("code");
        const state = reqUrl.searchParams.get("state") ?? undefined;
        if (!code) {
          res.statusCode = 400;
          res.end("Missing code");
          return;
        }
        if (expectedState && state !== expectedState) {
          res.statusCode = 400;
          res.end("State mismatch");
          return;
        }
        res.end("Authorization received. You can close this window.");
        server.close();
        resolve({ code, state });
      } catch (err) {
        reject(err);
      }
    });

    server.listen(port, hostname);

    const t = setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timeout"));
    }, timeoutMs);

    server.on("close", () => clearTimeout(t));
  });
}

export async function promptForCode(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const code = (await rl.question("Paste authorization code: ")).trim();
    return code;
  } finally {
    rl.close();
  }
}

export async function exchangeCodeForToken(cfg: OAuthConfig, code: string, codeVerifier: string): Promise<OAuthToken> {
  // Validate URLs before use
  isHttpsUrl(cfg.tokenUrl, "tokenUrl");
  isValidRedirectUri(cfg.redirectUri);
  
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    code_verifier: codeVerifier
  });
  if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);

  const res = await safeFetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(sanitizeError(`Token exchange failed: ${res.status} ${errorText}`));
  }
  
  const data = await res.json();
  return validateTokenResponse(data, res);
}

export async function refreshAccessToken(cfg: OAuthConfig, refreshToken: string): Promise<OAuthToken> {
  // Validate URL before use
  isHttpsUrl(cfg.tokenUrl, "tokenUrl");
  
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId
  });
  if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);

  const res = await safeFetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(sanitizeError(`Token refresh failed: ${res.status} ${errorText}`));
  }
  
  const data = await res.json();
  return validateTokenResponse(data, res);
}

export async function loginFlow(
  cfg: OAuthConfig,
  options?: { headless?: boolean; timeoutMs?: number; listenHost?: string }
) {
  // Validate all URLs at the start of the flow
  isHttpsUrl(cfg.authorizeUrl, "authorizeUrl");
  isHttpsUrl(cfg.tokenUrl, "tokenUrl");
  isValidRedirectUri(cfg.redirectUri);
  
  const pkce = createPkcePair();
  const state = randomState();
  const url = buildAuthorizeUrl(cfg, state, pkce.challenge);

  let code: string | null = null;
  const headless = options?.headless ?? false;

  if (!headless) {
    try {
      const wait = waitForCallback(
        cfg.redirectUri,
        state,
        options?.timeoutMs ?? cfg.callbackTimeoutMs ?? 120_000,
        options?.listenHost
      );
      if (cfg.openBrowser !== false) {
        await open(url);
      } else {
        process.stdout.write(url + "\n");
      }
      const res = await wait;
      code = res.code;
    } catch {
      // fall through to manual
      code = null;
    }
  }

  if (!code) {
    process.stdout.write(url + "\n");
    code = await promptForCode();
  }

  const token = await exchangeCodeForToken(cfg, code, pkce.verifier);
  return token;
}
