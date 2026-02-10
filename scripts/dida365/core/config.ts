import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Config } from "../types/config.js";

export async function fileExists(file: string) {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file: string): Promise<any> {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

export function defaultConfigPath() {
  return path.join(os.homedir(), ".config", "dida365.json");
}

export function cwdConfigPath() {
  return path.join(process.cwd(), "dida365.config.json");
}

export async function loadConfig(explicitPath?: string): Promise<{
  config: Config;
  path?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const candidates: string[] = [];

  if (explicitPath) candidates.push(explicitPath);
  if (process.env.DIDA365_CONFIG) candidates.push(process.env.DIDA365_CONFIG);
  candidates.push(cwdConfigPath());
  candidates.push(defaultConfigPath());

  for (const p of candidates) {
    if (await fileExists(p)) {
      try {
        const data = await readJson(p);
        return { config: data as Config, path: p, warnings };
      } catch (err: any) {
        warnings.push(`Failed to read config at ${p}: ${err?.message ?? String(err)}`);
        return { config: {}, path: p, warnings };
      }
    }
  }

  return { config: {}, warnings };
}

export async function writeConfig(filePath: string, config: Config) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf8");
}
