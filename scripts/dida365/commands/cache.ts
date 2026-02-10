import type { Command } from "commander";
import { withContext } from "../core/command.js";

export function registerCache(program: Command) {
  const cache = program.command("cache").description("Cache utilities");

  cache
    .command("status")
    .description("Show cache status")
    .action(
      withContext(async (ctx) => {
        const data = await ctx.cache.stats();
        return { data };
      })
    );

  cache
    .command("purge")
    .description("Purge cache")
    .option("--force", "Skip confirmation prompt")
    .action(
      withContext(async (ctx, options: { force?: boolean }) => {
        if (!options.force) {
          const readline = await import("readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(
              "Are you sure you want to purge all cache? This cannot be undone. [y/N]: ",
              (ans) => {
                rl.close();
                resolve(ans);
              }
            );
          });

          if (answer.toLowerCase() !== "y") {
            return { data: { cancelled: true } };
          }
        }

        await ctx.cache.purge();
        return { data: { purged: true } };
      })
    );
}
