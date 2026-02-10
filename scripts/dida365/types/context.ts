import type { Config } from "./config.js";
import type { Cache } from "../core/cache.js";
import type { Dida365Client } from "../core/api.js";

export interface GlobalOptions {
  json?: boolean;
  config?: string;
  token?: string;
  cacheDir?: string;
  timezone?: string;
}

export interface Context {
  json: boolean;
  config: Config;
  configPath?: string;
  warnings?: string[];
  cache: Cache;
  client: Dida365Client;
}

export interface CommandResult<T = any> {
  data: T;
  warnings?: string[];
  meta?: any;
}
