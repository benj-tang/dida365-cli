import type { Command } from "commander";
import type { TaskDraft } from "../types/task.js";
import { withContext } from "../core/command.js";
import { ValidationError } from "../core/errors.js";
import { ensureTagsOnTaskDraft } from "../core/tags.js";
import { pickDefined, toArray, uniq } from "../core/utils.js";

// Collect function for repeatable CLI options
function collect(value: string, previous: string[] = []): string[] {
  return previous.concat([value]);
}

function requireProjectId(projectId: string | undefined, action: string) {
  if (!projectId) throw new ValidationError(`projectId is required for tasks ${action}.`);
  return projectId;
}

function requireTaskId(taskId: string | undefined, action: string) {
  if (!taskId) throw new ValidationError(`taskId is required for tasks ${action}.`);
  return taskId;
}

function resolveEnableRequiredTags(opts: any, ctx: any) {
  if (opts.enableRequiredTags) return true;
  if (opts.disableRequiredTags) return false;
  return ctx.config.enableRequiredTags ?? true;
}

function normalizeDateToUtc(localDateTime: string, timeZone: string): string {
  // Parse "YYYY-MM-DD HH:mm" and convert to UTC format "YYYY-MM-DDTHH:mm:ss+0000"
  const [datePart, timePart] = localDateTime.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  
  // Create date in the specified timezone
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  
  // Adjust for timezone offset (simplified - uses system timezone)
  // For production, use a proper timezone library like date-fns-tz
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = utcDate.getTime() - tzDate.getTime();
  const adjusted = new Date(date.getTime() + offset);
  
  // Format as "YYYY-MM-DDTHH:mm:ss+0000"
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${adjusted.getUTCFullYear()}-${pad(adjusted.getUTCMonth() + 1)}-${pad(adjusted.getUTCDate())}T${pad(adjusted.getUTCHours())}:${pad(adjusted.getUTCMinutes())}:${pad(adjusted.getUTCSeconds())}+0000`;
}

function parseItems(opts: any, timeZone: string): any[] | undefined {
  const items: any[] = [];
  const rawItems = toArray(opts.item);
  for (const raw of rawItems) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed.startDate) {
        parsed.startDate = normalizeDateToUtc(parsed.startDate, timeZone);
      }
      if (parsed.completedTime) {
        parsed.completedTime = normalizeDateToUtc(parsed.completedTime, timeZone);
      }
      items.push(parsed);
    } catch (e) {
      // Ignore invalid items
    }
  }
  return items.length ? items : undefined;
}

function buildDraft(opts: any, ctx: any): TaskDraft {
  if (!opts.title) {
    throw new Error("Task title is required");
  }
  
  const timeZone = ctx.config.timezone ?? "Asia/Shanghai";
  
  const draft: TaskDraft = {
    title: opts.title,
    content: opts.content,
    desc: opts.desc,
    isAllDay: opts.allDay ? true : undefined,
    startDate: opts.start ? normalizeDateToUtc(opts.start, timeZone) : undefined,
    dueDate: opts.due ? normalizeDateToUtc(opts.due, timeZone) : undefined,
    repeatFlag: opts.repeatFlag,
    priority: opts.priority ? Number(opts.priority) : undefined,
    sortOrder: opts.sortOrder ? Number(opts.sortOrder) : undefined,
    timeZone
  };

  // Remove undefined values
  Object.keys(draft).forEach(key => {
    if (draft[key as keyof TaskDraft] === undefined) {
      delete draft[key as keyof TaskDraft];
    }
  });

  const reminders = toArray(opts.reminder);
  if (reminders.length) draft.reminders = reminders;

  const items = parseItems(opts, timeZone);
  if (items) draft.items = items;

  const tagHints = uniq([...toArray(opts.tag), ...toArray(opts.tagHint)]);
  const enableRequiredTags = resolveEnableRequiredTags(opts, ctx);

  return ensureTagsOnTaskDraft(draft, {
    requiredTags: ctx.config.requiredTags ?? ["cli"],
    tagHints,
    enableRequiredTags
  });
}

export function registerTasks(program: Command) {
  const tasks = program.command("tasks").description("Tasks operations");

  tasks
    .command("create")
    .description("Create a task (projectId required)")
    .requiredOption("--project-id <id>", "Project ID")
    .requiredOption("--title <title>", "Task title")
    .option("--content <content>")
    .option("--desc <desc>")
    .option("--start <datetime>")
    .option("--due <datetime>")
    .option("--all-day", "All day task")
    .option("--reminder <reminder>", "Reminder trigger (repeatable)", collect, [])
    .option("--repeat-flag <flag>")
    .option("--priority <n>")
    .option("--sort-order <n>", "Sort order")
    .option("--item <json>", "Subtask item as JSON (repeatable)", collect, [])
    .option("--tag <tag>", "Tag hint (repeatable)", collect, [])
    .option("--tag-hint <tagHint>", "Tag hint (repeatable)", collect, [])
    .option("--enable-required-tags")
    .option("--disable-required-tags")
    .action(
      withContext(async (ctx, opts) => {
        const projectId = requireProjectId(opts.projectId, "create");
        const draft = buildDraft(opts, ctx);
        const data = await ctx.client.tasksCreate(projectId, draft);
        await ctx.cache.invalidate("projects:list");
        await ctx.cache.invalidate(`tasks:get-all:${projectId}`);
        return { data };
      })
    );

  tasks
    .command("get")
    .description("Get a task")
    .requiredOption("--project-id <id>", "Project ID")
    .requiredOption("--task-id <id>", "Task ID")
    .action(
      withContext(async (ctx, opts) => {
        const data = await ctx.client.tasksGet(opts.projectId, opts.taskId);
        return { data };
      })
    );

  tasks
    .command("update")
    .description("Update a task")
    .requiredOption("--project-id <id>", "Project ID")
    .requiredOption("--task-id <id>", "Task ID")
    .option("--title <title>")
    .option("--content <content>")
    .option("--desc <desc>")
    .option("--start <datetime>")
    .option("--due <datetime>")
    .option("--all-day", "All day task")
    .option("--reminder <reminder>", "Reminder trigger (repeatable)", collect, [])
    .option("--repeat-flag <flag>")
    .option("--priority <n>")
    .option("--sort-order <n>", "Sort order")
    .option("--item <json>", "Subtask item as JSON (repeatable)", collect, [])
    .option("--tag <tag>", "Tag hint (repeatable)", collect, [])
    .option("--tag-hint <tagHint>", "Tag hint (repeatable)", collect, [])
    .option("--enable-required-tags")
    .option("--disable-required-tags")
    .action(
      withContext(async (ctx, opts) => {
        const projectId = requireProjectId(opts.projectId, "update");
        const taskId = requireTaskId(opts.taskId, "update");
        const draft = buildDraft(opts, ctx);
        const data = await ctx.client.tasksUpdate(projectId, taskId, draft);
        await ctx.cache.invalidate("projects:list");
        await ctx.cache.invalidate(`tasks:get-all:${projectId}`);
        return { data };
      })
    );

  tasks
    .command("complete")
    .description("Complete a task")
    .requiredOption("--project-id <id>", "Project ID")
    .requiredOption("--task-id <id>", "Task ID")
    .action(
      withContext(async (ctx, opts) => {
        const projectId = requireProjectId(opts.projectId, "complete");
        const taskId = requireTaskId(opts.taskId, "complete");
        const data = await ctx.client.tasksComplete(projectId, taskId);
        await ctx.cache.invalidate("projects:list");
        await ctx.cache.invalidate(`tasks:get-all:${projectId}`);
        return { data };
      })
    );

  tasks
    .command("delete")
    .description("Delete a task")
    .requiredOption("--project-id <id>", "Project ID")
    .requiredOption("--task-id <id>", "Task ID")
    .option("--force", "Confirm delete")
    .action(
      withContext(async (ctx, opts) => {
        if (!opts.force) throw new ValidationError("Refusing to delete without --force.");
        const projectId = requireProjectId(opts.projectId, "delete");
        const taskId = requireTaskId(opts.taskId, "delete");
        const data = await ctx.client.tasksDelete(projectId, taskId);
        await ctx.cache.invalidate("projects:list");
        await ctx.cache.invalidate(`tasks:get-all:${projectId}`);
        return { data };
      })
    );

  tasks
    .command("search")
    .argument("[query]", "Search keyword (matches title/content/desc)")
    .description("Search tasks by keyword (local implementation with cache)")
    .option("--project-ids <ids>", "Comma-separated project IDs to search (default: all projects)")
    .option("--status <status>", "Filter by status (0=active, 2=completed)")
    .option("--force-refresh", "Bypass cache and fetch fresh data")
    .action(
      withContext(async (ctx, opts, command) => {
        // Get target project IDs
        let projectIds: string[];
        if (opts.projectIds) {
          projectIds = opts.projectIds.split(",").map((s: string) => s.trim()).filter(Boolean);
        } else {
          // Fetch all projects first
          const projects = await ctx.client.projectsList();
          projectIds = (projects ?? []).map((p: any) => p.id);
        }

        if (projectIds.length === 0) {
          throw new ValidationError("No projects to search");
        }

        // Fetch tasks for each project (with cache support)
        const fetchProjectTasks = async (projectId: string) => {
          const cacheKey = `tasks:get-all:${projectId}`;
          // Use tasks-specific cache TTL, default 10 minutes (600 seconds)
          const ttlMs = (ctx.config.tasksCacheTtlSeconds ?? 600) * 1000;

          if (opts.forceRefresh) {
            const data = await ctx.client.tasksGetAll(projectId);
            await ctx.cache.set(cacheKey, data, ttlMs);
            return data;
          }

          const result = await ctx.cache.fetch(
            cacheKey,
            () => ctx.client.tasksGetAll(projectId),
            { ttlMs }
          );
          return result.value;
        };

        // Get query from positional arg or --query option
        const query = command.args?.[0] || (opts as any).query;
        if (!query) {
          throw new ValidationError("Search query is required. Use: dida365 tasks search <keyword>");
        }

        const searchParams = {
          query,
          projectIds,
          status: opts.status !== undefined ? Number(opts.status) : undefined
        };

        const data = await ctx.client.tasksSearchLocal(searchParams, fetchProjectTasks);
        return { data };
      })
    );

  tasks
    .command("get-all")
    .description("Get all tasks (default: all projects; use --project-id for specific project)")
    .option("-p, --project-id <id>", "Project ID (omit for all projects)")
    .option("--force-refresh", "Bypass cache")
    .action(
      withContext(async (ctx, opts) => {
        const ttlMs = (ctx.config.tasksCacheTtlSeconds ?? 600) * 1000;

        if (opts.projectId) {
          // Specific project - use existing logic
          const projectId = opts.projectId;
          const cacheKey = `tasks:get-all:${projectId}`;

          if (opts.forceRefresh) {
            const data = await ctx.client.tasksGetAll(projectId);
            await ctx.cache.set(cacheKey, data, ttlMs);
            return { data, meta: { cache: { source: "origin", forced: true } } };
          }

          const result = await ctx.cache.fetch(cacheKey, () => ctx.client.tasksGetAll(projectId), { ttlMs });
          const warnings: string[] = [];
          if (result.stale) warnings.push("Returned stale cache due to fetch error.");
          return { data: result.value, warnings, meta: { cache: { source: result.source, stale: result.stale } } };
        } else {
          // All projects - traverse and aggregate
          const cacheKey = "tasks:get-all:all";

          if (opts.forceRefresh) {
            // Get all projects, then fetch tasks for each
            const projects = await ctx.client.projectsList();
            const allTasks: any[] = [];
            for (const p of projects) {
              const tasksResult = await ctx.client.tasksGetAll(p.id);
              const tasks = (tasksResult as any)?.tasks || [];
              allTasks.push(...tasks);
            }
            await ctx.cache.set(cacheKey, allTasks, ttlMs);
            return { data: allTasks, meta: { cache: { source: "origin", forced: true } } };
          }

          const result = await ctx.cache.fetch(cacheKey, async () => {
            const projects = await ctx.client.projectsList();
            const allTasks: any[] = [];
            for (const p of projects) {
              const tasksResult = await ctx.client.tasksGetAll(p.id);
              const tasks = (tasksResult as any)?.tasks || [];
              allTasks.push(...tasks);
            }
            return allTasks;
          }, { ttlMs });

          const warnings: string[] = [];
          if (result.stale) warnings.push("Returned stale cache due to fetch error.");
          return { data: result.value, warnings, meta: { cache: { source: result.source, stale: result.stale } } };
        }
      })
    );
}
