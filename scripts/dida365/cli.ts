#!/usr/bin/env node
import { Command } from "commander";
import { registerStatus } from "./commands/status.js";
import { registerAuth } from "./commands/auth.js";
import { registerProjects } from "./commands/projects.js";
import { registerTasks } from "./commands/tasks.js";
import { registerCache } from "./commands/cache.js";
import { registerConfig } from "./commands/config.js";

const program = new Command();
program
  .name("dida365")
  .description("Dida365 CLI skill scaffold")
  .option("--json", "Output JSON envelope")
  .option("--config <path>", "Path to config JSON")
  .option("--token <token>", "API token override")
  .option("--cache-dir <dir>", "Cache directory")
  .option("--timezone <tz>", "Timezone override");

registerStatus(program);
registerAuth(program);
registerConfig(program);
registerProjects(program);
registerTasks(program);
registerCache(program);

program.showHelpAfterError();
program.parseAsync(process.argv);
