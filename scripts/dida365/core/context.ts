import path from "node:path";
import os from "node:os";
import type { GlobalOptions, Context } from "../types/context.js";
import type { Config } from "../types/config.js";
import type { OAuthToken } from "./token.js";
import { loadConfig } from "./config.js";
import { Cache } from "./cache.js";
import { HttpClient } from "./http.js";
import { Dida365Client } from "./api.js";

// Type definitions for the merged configuration
interface MergedConfig {
  token?: string;
  timezone?: string;
  requiredTags?: string[];
  enableRequiredTags?: boolean;
  cacheDir?: string;
  cacheTtlSeconds?: number;
  cacheStaleIfErrorSeconds?: number;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  oauth?: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    tokenPath?: string;
  };
}

interface TokenModule {
  resolveTokenPath: (cfg: any) => string;
  loadToken: (tokenPath: string) => Promise<OAuthToken | null>;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateNumericOption(value: number | undefined, name: string, min: number, max: number, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: must be a number between ${min} and ${max}, got ${value}`);
  }
  return value;
}

function validateTimeoutMs(value: number | undefined): number {
  return validateNumericOption(value, "timeoutMs", 1000, 300000, 15000);
}

function validateRetries(value: number | undefined): number {
  return validateNumericOption(value, "retries", 0, 10, 3);
}

function validateCacheTtlSeconds(value: number | undefined): number {
  return validateNumericOption(value, "cacheTtlSeconds", 1, 604800, 3600);
}

function validateCacheStaleIfErrorSeconds(value: number | undefined): number {
  return validateNumericOption(value, "cacheStaleIfErrorSeconds", 1, 604800, 86400);
}

export async function buildContext(opts: GlobalOptions): Promise<Context> {
  let config: Config;
  let configPath: string | undefined;
  let warnings: string[] | undefined;

  try {
    const result = await loadConfig(opts.config);
    config = result.config;
    warnings = result.warnings;
    configPath = result.path;
  } catch (e) {
    throw new Error(`Failed to load configuration: ${e instanceof Error ? e.message : String(e)}`);
  }

  const tagsCfg = config.tags ?? {};
  const oauthCfg = config.oauth ?? {};
  const cacheCfg = config.cache ?? {};
  const httpCfg = config.http ?? {};

  // nested -> flat merge (nested wins)
  const merged: MergedConfig = {
    ...config,

    // common
    token: opts.token ?? config.token,
    timezone: opts.timezone ?? config.timezone,

    // tags
    requiredTags: tagsCfg.requiredTags ?? config.requiredTags,
    enableRequiredTags: tagsCfg.enableRequiredTags ?? config.enableRequiredTags,

    // cache
    cacheDir: opts.cacheDir ?? config.cacheDir ?? cacheCfg.dir,
    cacheTtlSeconds: cacheCfg.ttlSeconds ?? config.cacheTtlSeconds,
    cacheStaleIfErrorSeconds: cacheCfg.staleIfErrorSeconds ?? config.cacheStaleIfErrorSeconds,

    // http
    baseUrl: httpCfg.baseUrl ?? config.baseUrl,
    timeoutMs: httpCfg.timeoutMs ?? config.timeoutMs,
    retries: httpCfg.retries ?? config.retries,

    // oauth (kept nested)
    oauth: oauthCfg
  };

  // Validate token if provided
  if (merged.token !== undefined && typeof merged.token !== "string") {
    throw new Error("Invalid token: must be a string");
  }
  if (merged.token && merged.token.length === 0) {
    throw new Error("Invalid token: cannot be empty string");
  }

  const cacheDir = merged.cacheDir ?? path.join(os.homedir(), ".cache", "dida365-cli");

  // Validate cache TTL values before creating Cache
  const validatedCacheTtlSeconds = validateCacheTtlSeconds(merged.cacheTtlSeconds);
  const validatedCacheStaleIfErrorSeconds = validateCacheStaleIfErrorSeconds(merged.cacheStaleIfErrorSeconds);

  const cache = new Cache({
    dir: cacheDir,
    ttlMs: validatedCacheTtlSeconds * 1000,
    staleIfErrorMs: validatedCacheStaleIfErrorSeconds * 1000
  });

  // Token resolution:
  // - explicit --token / config.token is allowed as override
  // - otherwise try reading OAuth token file (preferred)
  // NOTE: token file reading is done lazily here to keep HttpClient simple.
  let tokenModule: TokenModule;
  try {
    const module = await import("./token.js") as TokenModule;
    tokenModule = module;
  } catch (e) {
    throw new Error(`Failed to load token module: ${e instanceof Error ? e.message : String(e)}`);
  }

  const resolveTokenPath = tokenModule.resolveTokenPath;
  const loadToken = tokenModule.loadToken;

  const tokenPath = resolveTokenPath(merged);
  let tokenData: OAuthToken | null = null;

  if (!merged.token) {
    try {
      tokenData = await loadToken(tokenPath);
    } catch (e) {
      throw new Error(`Failed to load token from ${tokenPath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Validate that we have an access token
  const accessToken = merged.token ?? tokenData?.access_token;
  if (!accessToken || typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("No valid access token found. Provide --token or configure OAuth authentication.");
  }

  // Ensure baseUrl has trailing slash for correct URL resolution
  let baseUrl = merged.baseUrl ?? "https://api.dida365.com/open/v1";
  
  // Validate baseUrl format
  if (!isValidUrl(baseUrl)) {
    throw new Error(`Invalid baseUrl: "${baseUrl}". Must be a valid HTTP/HTTPS URL.`);
  }
  if (!baseUrl.endsWith("/")) baseUrl += "/";

  // Validate numeric HTTP options
  const validatedTimeoutMs = validateTimeoutMs(merged.timeoutMs);
  const validatedRetries = validateRetries(merged.retries);

  const http = new HttpClient({
    baseUrl,
    token: accessToken,
    timeoutMs: validatedTimeoutMs,
    retries: validatedRetries
  });

  const client = new Dida365Client({ http });

  return {
    json: opts.json ?? false,
    config: merged,
    configPath,
    warnings,
    cache,
    client
  };
}
