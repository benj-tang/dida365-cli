import type { Command } from "commander";
import { withContext } from "../core/command.js";
import { ValidationError } from "../core/errors.js";
import { pickDefined } from "../core/utils.js";

export function registerProjects(program: Command) {
  const projects = program.command("projects").description("Projects operations");

  projects
    .command("list")
    .description("List projects (cache-first)")
    .option("--force-refresh", "Bypass cache")
    .action(
      withContext(async (ctx, opts) => {
        const cacheKey = "projects:list";
        // Use projects-specific cache TTL, default 7 days (604800 seconds)
        const ttlMs = (ctx.config.projectsCacheTtlSeconds ?? 604800) * 1000;

        if (opts.forceRefresh) {
          const data = await ctx.client.projectsList();
          await ctx.cache.set(cacheKey, data, ttlMs);
          return { data, meta: { cache: { source: "origin", forced: true } } };
        }

        const result = await ctx.cache.fetch(cacheKey, () => ctx.client.projectsList(), { ttlMs });

        const warnings: string[] = [];
        if (result.stale) warnings.push("Returned stale cache due to fetch error.");

        return {
          data: result.value,
          warnings,
          meta: { cache: { source: result.source, stale: result.stale, cachedAt: result.cachedAt } }
        };
      })
    );

  projects
    .command("create")
    .description("Create a project")
    .requiredOption("--name <name>", "Project name")
    .option("--color <color>", "Color hex (e.g., #F18181)")
    .option("--view-mode <mode>", "View mode: list | kanban | timeline")
    .option("--kind <kind>", "Kind: TASK | NOTE")
    .option("--sort-order <n>", "Sort order", (v) => Number(v))
    .action(
      withContext(async (ctx, opts) => {
        const body = pickDefined({
          name: opts.name,
          color: opts.color,
          viewMode: opts.viewMode,
          kind: opts.kind,
          sortOrder: opts.sortOrder
        });
        const data = await ctx.client.projectsCreate(body);
        await ctx.cache.invalidate("projects:list");
        return { data };
      })
    );

  projects
    .command("update")
    .description("Update a project")
    .requiredOption("--project-id <id>", "Project ID")
    .option("--name <name>", "Project name")
    .option("--color <color>", "Color hex")
    .option("--view-mode <mode>", "View mode")
    .option("--kind <kind>", "Kind")
    .option("--sort-order <n>", "Sort order", (v) => Number(v))
    .action(
      withContext(async (ctx, opts) => {
        if (!opts.projectId) throw new ValidationError("--project-id is required");
        const body = pickDefined({
          name: opts.name,
          color: opts.color,
          viewMode: opts.viewMode,
          kind: opts.kind,
          sortOrder: opts.sortOrder
        });
        const data = await ctx.client.projectsUpdate(opts.projectId, body);
        await ctx.cache.invalidate("projects:list");
        return { data };
      })
    );

  projects
    .command("delete")
    .description("Delete a project")
    .requiredOption("--project-id <id>", "Project ID")
    .option("--force", "Confirm deletion")
    .action(
      withContext(async (ctx, opts) => {
        if (!opts.projectId) throw new ValidationError("--project-id is required");
        if (!opts.force) throw new ValidationError("Refusing to delete without --force");
        const data = await ctx.client.projectsDelete(opts.projectId);
        await ctx.cache.invalidate("projects:list");
        return { data };
      })
    );
}
