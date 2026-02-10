import type { Command } from "commander";
import type { CommandResult } from "../types/context.js";
import { buildContext } from "./context.js";
import { outputSuccess, outputError } from "./output.js";

export function withContext(action: (ctx: any, opts: any, command: Command) => Promise<CommandResult>) {
  return async (...args: any[]) => {
    const command = args[args.length - 1] as Command;
    const opts = command.opts();
    // commander v11: find root command by walking parents
    let root: any = command;
    while (root?.parent) root = root.parent;
    const globalOpts = root.opts();
    const ctx = await buildContext(globalOpts);
    try {
      const result = await action(ctx, opts, command);
      outputSuccess(ctx, result.data, result.warnings, result.meta);
    } catch (err) {
      outputError(ctx, err);
    }
  };
}
