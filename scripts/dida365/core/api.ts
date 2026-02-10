import type { Task, TaskCreateParams, TaskStatus } from "../types/api.js";
import type { HttpClient } from "./http.js";
import type { SearchResult } from "../types/api.js";
import { ValidationError, NotFoundError } from "./errors.js";

/**
 * Validates that an ID contains only safe characters
 */
function validateId(id: unknown, name: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError(`${name} must be a non-empty string`, name);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new ValidationError(`${name} contains invalid characters (only alphanumeric, dash, underscore allowed)`, name);
  }
}

/**
 * Validates project creation/update parameters
 */
function validateProjectParams(body: { name?: string; color?: string; sortOrder?: number; viewMode?: string; kind?: string }, isCreate: boolean): void {
  if (isCreate) {
    validateProjectName(body.name);
  }
  if (body.name !== undefined && body.name !== null) {
    validateProjectName(body.name);
  }
  if (body.sortOrder !== undefined && (typeof body.sortOrder !== "number" || body.sortOrder < 0)) {
    throw new ValidationError("sortOrder must be a non-negative number", "sortOrder");
  }
  if (body.viewMode !== undefined && typeof body.viewMode !== "string") {
    throw new ValidationError("viewMode must be a string", "viewMode");
  }
  if (body.kind !== undefined && typeof body.kind !== "string") {
    throw new ValidationError("kind must be a string", "kind");
  }
}

/**
 * Validates task search parameters
 */
function validateSearchParams(params: { query?: string; projectIds?: unknown; status?: number }): void {
  if (params.query !== undefined && typeof params.query !== "string") {
    throw new ValidationError("query must be a string", "query");
  }
  if (params.query && params.query.length > 1000) {
    throw new ValidationError("query must be 1000 characters or less", "query");
  }
  if (params.projectIds !== undefined && !Array.isArray(params.projectIds)) {
    throw new ValidationError("projectIds must be an array", "projectIds");
  }
  if (params.projectIds && (params.projectIds as unknown[]).length > 100) {
    throw new ValidationError("projectIds must be 100 or fewer", "projectIds");
  }
  if (params.status !== undefined && (typeof params.status !== "number" || ![0, 1].includes(params.status))) {
    throw new ValidationError("status must be 0 (active) or 1 (completed)", "status");
  }
}

/**
 * Validates that a project name is non-empty
 */
function validateProjectName(name: unknown): void {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new ValidationError("Project name must be a non-empty string", "name");
  }
}

export class Dida365Client {
  private http: HttpClient;

  constructor(opts: { http: HttpClient }) {
    this.http = opts.http;
  }

  // ============ Projects ============

  /** Lists all projects for the authenticated user */
  async projectsList(): Promise<Array<{ id: string; name: string; [key: string]: any }>> {
    return this.http.request("GET", "project");
  }

  /** Creates a new project */
  async projectsCreate(body: { name: string; color?: string; sortOrder?: number; viewMode?: string; kind?: string }): Promise<{ id: string }> {
    validateProjectParams(body, true);
    return this.http.request("POST", "project", body);
  }

  /** Updates an existing project */
  async projectsUpdate(projectId: string, body: { name?: string; color?: string; sortOrder?: number; viewMode?: string; kind?: string }): Promise<{ id: string }> {
    validateId(projectId, "projectId");
    validateProjectParams(body, false);
    return this.http.request("POST", `project/${projectId}`, body);
  }

  /** Deletes a project */
  async projectsDelete(projectId: string): Promise<void> {
    validateId(projectId, "projectId");
    return this.http.request("DELETE", `project/${projectId}`);
  }

  // ============ Tasks ============

  /** Creates a new task in the specified project */
  async tasksCreate(projectId: string, draft: TaskCreateParams): Promise<{ id: string }> {
    validateId(projectId, "projectId");
    if (!draft.title || draft.title.trim().length === 0) {
      throw new ValidationError("Task title is required", "title");
    }
    return this.http.request("POST", "task", { ...draft, projectId });
  }

  /** Gets a single task by ID */
  async tasksGet(projectId: string, taskId: string): Promise<Task> {
    validateId(projectId, "projectId");
    validateId(taskId, "taskId");
    return this.http.request("GET", `project/${projectId}/task/${taskId}`);
  }

  /** Updates an existing task */
  async tasksUpdate(projectId: string, taskId: string, draft: Partial<TaskCreateParams>): Promise<Task> {
    validateId(projectId, "projectId");
    validateId(taskId, "taskId");
    // Don't let draft.id override the path id - filter it out and remove undefined values
    const { id: _draftId, ...tempDraft } = (draft || {}) as any;
    const safeDraft = Object.fromEntries(Object.entries(tempDraft).filter(([_, v]) => v !== undefined));
    return this.http.request("POST", `task/${taskId}`, { ...safeDraft, projectId, id: taskId });
  }

  /** Marks a task as completed */
  async tasksComplete(projectId: string, taskId: string): Promise<void> {
    validateId(projectId, "projectId");
    validateId(taskId, "taskId");
    return this.http.request("POST", `project/${projectId}/task/${taskId}/complete`);
  }

  /** Deletes a task */
  async tasksDelete(projectId: string, taskId: string): Promise<void> {
    validateId(projectId, "projectId");
    validateId(taskId, "taskId");
    return this.http.request("DELETE", `project/${projectId}/task/${taskId}`);
  }

  /** Gets all tasks for a project */
  async tasksGetAll(projectId: string): Promise<{ tasks: Task[] }> {
    validateId(projectId, "projectId");
    return this.http.request("GET", `project/${projectId}/data`);
  }

  /**
   * Searches tasks across multiple projects (local filtering)
   * @param params - Search parameters (query, projectIds, status)
   * @param fetcher - Function to fetch tasks for a project
   * @param options - Options (parallel, timeoutMs)
   */
  async tasksSearchLocal(
    params: { query?: string; projectIds?: string[]; status?: TaskStatus },
    fetcher: (projectId: string) => Promise<{ tasks: Task[] }>,
    options?: { parallel?: boolean; timeoutMs?: number }
  ): Promise<SearchResult<Task>> {
    // Validate search params
    validateSearchParams(params);

    const targetProjectIds = params.projectIds ?? [];
    if (targetProjectIds.length === 0) {
      throw new ValidationError("At least one projectId is required for search", "projectIds");
    }

    // Validate all project IDs upfront
    for (const pid of targetProjectIds) {
      validateId(pid, "projectId");
    }

    // Normalize query: empty string → undefined
    const query = params.query?.trim();
    const searchQuery = query && query.length > 0 ? query : undefined;

    // Parallel fetching (default true)
    const parallel = options?.parallel !== false;
    const timeoutMs = options?.timeoutMs ?? 30000;
    const startTime = Date.now();
    const errors: Array<{ projectId: string; error: string }> = [];

    let results: Task[];

    if (parallel) {
      // Parallel fetch with error handling per project
      const fetchPromises = targetProjectIds.map(async (projectId) => {
        try {
          // Check timeout before each fetch
          if (Date.now() - startTime > timeoutMs) {
            throw new Error("Search timeout exceeded");
          }
          const data = await fetcher(projectId);
          return { projectId, tasks: data.tasks ?? [], error: null };
        } catch (err) {
          const errorMsg = (err as Error).message;
          errors.push({ projectId, error: errorMsg });
          return { projectId, tasks: [], error: errorMsg };
        }
      });

      const fetchResults = await Promise.allSettled(fetchPromises);

      // Extract results from PromiseSettledResult
      results = [];
      for (const result of fetchResults) {
        if (result.status === "rejected") {
          // This shouldn't happen since we catch inside, but handle it anyway
          continue;
        }
        const { projectId, tasks } = result.value;
        for (const task of tasks) {
          // Filter by status
          if (params.status !== undefined && task.status !== params.status) {
            continue;
          }

          // Filter by query (title, content, desc)
          if (searchQuery) {
            const hay = [task.title, task.content, task.desc]
              .map((f) => (f ?? "").trim())
              .filter((s) => s.length > 0)
              .join(" ")
              .toLowerCase();
            if (!hay.includes(searchQuery.toLowerCase())) {
              continue;
            }
          }

          results.push(task);
        }
      }
    } else {
      // Sequential fetch (original behavior)
      results = [];
      for (const projectId of targetProjectIds) {
        try {
          const data = await fetcher(projectId);
          const tasks = data.tasks ?? [];

          for (const task of tasks) {
            if (params.status !== undefined && task.status !== params.status) {
              continue;
            }

            if (searchQuery) {
              const hay = [task.title, task.content, task.desc]
                .map((f) => (f ?? "").trim())
                .filter((s) => s.length > 0)
                .join(" ")
                .toLowerCase();
              if (!hay.includes(searchQuery.toLowerCase())) {
                continue;
              }
            }

            results.push(task);
          }
        } catch (err) {
          errors.push({ projectId, error: (err as Error).message });
        }
      }
    }

    return {
      results,
      total: results.length,
      projectsSearched: targetProjectIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
