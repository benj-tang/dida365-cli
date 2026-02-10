import type { Command } from "commander";
import { withContext } from "../core/command.js";
import { ValidationError } from "../core/errors.js";
import { loadConfig, writeConfig, cwdConfigPath, defaultConfigPath, fileExists } from "../core/config.js";
import { parseJsonValue, setByDottedPath } from "../core/utils.js";
import schema from "../../../config/dida365.schema.json" with { type: "json" };
import { validateAgainstSchema } from "../core/schema.js";

async function resolveWritePath(explicitConfigPath?: string) {
  if (explicitConfigPath) return explicitConfigPath;
  if (process.env.DIDA365_CONFIG) return process.env.DIDA365_CONFIG;
  // Prefer cwd config if present, else default home config.
  if (await fileExists(cwdConfigPath())) {
    return cwdConfigPath();
  }
  return defaultConfigPath();
}

export function registerConfig(program: Command) {
  const cfg = program.command("config").description("Config utilities");

  cfg
    .command("get")
    .description("Get current config (or a single key)")
    .argument("[key]", "Optional dotted key (e.g. timezone)")
    .action(
      withContext(async (_ctx, _opts, command) => {
        let root: any = command;
        let iterations = 0;
        while (root?.parent && iterations < 10) {
          root = root.parent;
          iterations++;
        }
        const globalOpts = root.opts();

        const { config, path } = await loadConfig(globalOpts.config);
        const key = command.args?.[0] as string | undefined;

        if (!key) {
          return { data: { config, path: path ?? null, defaults: { home: defaultConfigPath(), cwd: cwdConfigPath() } } };
        }

        const parts = key.split(".").filter(Boolean);
        let cur: any = config;
        for (const p of parts) {
          cur = cur?.[p];
        }
        return { data: { key, value: cur ?? null, path: path ?? null } };
      })
    );

  cfg
    .command("set")
    .description("Set a config key and write back to config file")
    .argument("<key>", "Dotted key path, e.g. timezone or requiredTags")
    .argument("<value>", "Value. Use JSON for arrays/objects, e.g. '[" + "\"OpenClaw\"" + "]'")
    .option("--file <path>", "Write to a specific config file (overrides --config)")
    .action(
      withContext(async (_ctx, opts, command) => {
        let root: any = command;
        let iterations = 0;
        while (root?.parent && iterations < 10) {
          root = root.parent;
          iterations++;
        }
        const globalOpts = root.opts();

        const key = command.args?.[0] as string | undefined;
        const rawValue = command.args?.[1] as string | undefined;
        if (!key) throw new ValidationError("Missing key.");
        if (rawValue === undefined) throw new ValidationError("Missing value.");

        const value = parseJsonValue(rawValue);

        const read = await loadConfig(opts.file ?? globalOpts.config);
        const nextConfig: any = { ...(read.config ?? {}) };
        setByDottedPath(nextConfig, key, value);

        // Validate against schema (production-grade guardrail)
        const errors = validateAgainstSchema(schema as any, nextConfig as any);
        if (errors.length) {
          throw new ValidationError(`Config validation failed: ${errors.join("; ")}`);
        }

        const outPath = opts.file ?? await resolveWritePath(globalOpts.config);
        await writeConfig(outPath, nextConfig);

        return { data: { path: outPath, key, value, config: nextConfig } };
      })
    );
}
