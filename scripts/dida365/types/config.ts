export interface OAuthConfig {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  redirectUri?: string;
  listenHost?: string;      // Local server bind address (default: 127.0.0.1)
  redirectPort?: number;    // Local server port (default: parsed from redirectUri)
  scope?: string;
  tokenPath?: string;
  openBrowser?: boolean;
  callbackTimeoutMs?: number;
}

export interface TagsConfig {
  requiredTags?: string[];
  enableRequiredTags?: boolean;
}

export interface CacheConfig {
  dir?: string;
  ttlSeconds?: number;
  staleIfErrorSeconds?: number;
}

export interface HttpConfig {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface Config {
  token?: string;
  baseUrl?: string;
  authBase?: string;
  cacheDir?: string;
  timezone?: string;

  requiredTags?: string[];
  enableRequiredTags?: boolean;

  cacheTtlSeconds?: number;
  cacheStaleIfErrorSeconds?: number;
  
  // Separate cache TTL for projects and tasks
  projectsCacheTtlSeconds?: number;  // Default: 7 days (604800)
  tasksCacheTtlSeconds?: number;     // Default: 10 minutes (600)

  timeoutMs?: number;
  retries?: number;

  // Nested configs
  oauth?: OAuthConfig;
  tags?: TagsConfig;
  cache?: CacheConfig;
  http?: HttpConfig;
}
