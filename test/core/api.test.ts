/**
 * Dida365Client API unit tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dida365Client } from "../../scripts/dida365/core/api.js";
import { HttpClient } from "../../scripts/dida365/core/http.js";
import { ValidationError } from "../../scripts/dida365/core/errors.js";
import type { Task } from "../../scripts/dida365/types/api.js";

// TaskStatus enum values
const TaskStatus = { Active: 0, Completed: 1 } as const;

describe("Dida365Client", () => {
  let client: Dida365Client;
  let mockHttp: HttpClient;
  const mockRequest = vi.fn();

  beforeEach(() => {
    mockHttp = {
      request: mockRequest
    } as unknown as HttpClient;
    client = new Dida365Client({ http: mockHttp });
    vi.clearAllMocks();
  });

  describe("projectsList", () => {
    it("should fetch projects", async () => {
      // NOTE: API returns array directly, NOT { projects: [...] }
      const mockProjects = [
        { id: "1", name: "Test Project", kind: "TASK" }
      ];
      mockRequest.mockResolvedValueOnce(mockProjects);

      const result = await client.projectsList();

      expect(result).toEqual(mockProjects);
      expect(mockRequest).toHaveBeenCalledWith("GET", "project");
    });
  });

  describe("projectsCreate", () => {
    it("should create project with valid name", async () => {
      mockRequest.mockResolvedValueOnce({ id: "new-id" });

      const result = await client.projectsCreate({ name: "New Project" });

      expect(result).toEqual({ id: "new-id" });
    });

    it("should throw ValidationError for empty name", async () => {
      await expect(client.projectsCreate({ name: "" }))
        .rejects.toThrow(ValidationError);
    });

    it("should validate sortOrder is non-negative", async () => {
      await expect(client.projectsCreate({ name: "Test", sortOrder: -1 }))
        .rejects.toThrow(ValidationError);
    });

    it("should accept valid optional fields", async () => {
      mockRequest.mockResolvedValueOnce({ id: "1" });

      await client.projectsCreate({
        name: "Test",
        color: "#ff0000",
        sortOrder: 10,
        viewMode: "list",
        kind: "project"
      });

      expect(mockRequest).toHaveBeenCalledWith("POST", "project", expect.objectContaining({
        name: "Test",
        color: "#ff0000"
      }));
    });
  });

  describe("projectsUpdate", () => {
    it("should validate projectId", async () => {
      await expect(client.projectsUpdate("invalid/id", { name: "Test" }))
        .rejects.toThrow(ValidationError);
    });

    it("should update project", async () => {
      mockRequest.mockResolvedValueOnce({ id: "1" });

      await client.projectsUpdate("valid-id", { name: "Updated" });

      expect(mockRequest).toHaveBeenCalledWith("POST", "project/valid-id", { name: "Updated" });
    });
  });

  describe("projectsDelete", () => {
    it("should validate projectId", async () => {
      await expect(client.projectsDelete("invalid!id"))
        .rejects.toThrow(ValidationError);
    });

    it("should delete project", async () => {
      mockRequest.mockResolvedValueOnce(undefined);

      await client.projectsDelete("valid-id");

      expect(mockRequest).toHaveBeenCalledWith("DELETE", "project/valid-id");
    });
  });

  describe("tasksCreate", () => {
    it("should validate projectId", async () => {
      await expect(client.tasksCreate("invalid/id", { title: "Task" }))
        .rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for empty title", async () => {
      await expect(client.tasksCreate("valid-id", { title: "" }))
        .rejects.toThrow(ValidationError);
    });

    it("should create task with title", async () => {
      mockRequest.mockResolvedValueOnce({ id: "task-1" });

      const result = await client.tasksCreate("project-1", { title: "New Task" });

      expect(result).toEqual({ id: "task-1" });
      expect(mockRequest).toHaveBeenCalledWith("POST", "task", expect.objectContaining({
        title: "New Task",
        projectId: "project-1"
      }));
    });
  });

  describe("tasksGet", () => {
    it("should validate both IDs", async () => {
      await expect(client.tasksGet("invalid!", "valid-id"))
        .rejects.toThrow(ValidationError);

      await expect(client.tasksGet("valid-id", "invalid!"))
        .rejects.toThrow(ValidationError);
    });

    it("should fetch task", async () => {
      const mockTask: Task = {
        id: "task-1",
        projectId: "project-1",
        title: "Test Task",
        status: TaskStatus.Active,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString()
      };
      mockRequest.mockResolvedValueOnce(mockTask);

      const result = await client.tasksGet("project-1", "task-1");

      expect(result).toEqual(mockTask);
      expect(mockRequest).toHaveBeenCalledWith("GET", "project/project-1/task/task-1");
    });
  });

  describe("tasksUpdate", () => {
    it("should validate both IDs", async () => {
      await expect(client.tasksUpdate("invalid!", "valid-id", { title: "Test" }))
        .rejects.toThrow(ValidationError);

      await expect(client.tasksUpdate("valid-id", "invalid!", { title: "Test" }))
        .rejects.toThrow(ValidationError);
    });

    it("should filter out undefined values", async () => {
      mockRequest.mockResolvedValueOnce({ id: "task-1" });

      await client.tasksUpdate("project-1", "task-1", {
        title: "Updated",
        content: undefined,
        desc: undefined
      });

      expect(mockRequest).toHaveBeenCalledWith(
        "POST",
        "task/task-1",
        expect.objectContaining({
          title: "Updated",
          projectId: "project-1",
          id: "task-1"
        })
      );
      // Ensure undefined values are not included
      const callArg = mockRequest.mock.calls[0][2];
      expect(callArg.content).toBeUndefined();
      expect(callArg.desc).toBeUndefined();
    });

    it("should override draft.id with path id", async () => {
      mockRequest.mockResolvedValueOnce({ id: "task-1" });

      await client.tasksUpdate("project-1", "task-original", {
        id: "task-should-be-ignored",
        title: "Updated"
      } as any);

      expect(mockRequest).toHaveBeenCalledWith(
        "POST",
        "task/task-original",
        expect.objectContaining({
          id: "task-original"
        })
      );
    });
  });

  describe("tasksComplete", () => {
    it("should validate both IDs", async () => {
      await expect(client.tasksComplete("invalid!", "valid-id"))
        .rejects.toThrow(ValidationError);

      await expect(client.tasksComplete("valid-id", "invalid!"))
        .rejects.toThrow(ValidationError);
    });

    it("should complete task", async () => {
      mockRequest.mockResolvedValueOnce(undefined);

      await client.tasksComplete("project-1", "task-1");

      expect(mockRequest).toHaveBeenCalledWith("POST", "project/project-1/task/task-1/complete");
    });
  });

  describe("tasksDelete", () => {
    it("should validate both IDs", async () => {
      await expect(client.tasksDelete("invalid!", "valid-id"))
        .rejects.toThrow(ValidationError);

      await expect(client.tasksDelete("valid-id", "invalid!"))
        .rejects.toThrow(ValidationError);
    });

    it("should delete task", async () => {
      mockRequest.mockResolvedValueOnce(undefined);

      await client.tasksDelete("project-1", "task-1");

      expect(mockRequest).toHaveBeenCalledWith("DELETE", "project/project-1/task/task-1");
    });
  });

  describe("tasksGetAll", () => {
    it("should validate projectId", async () => {
      await expect(client.tasksGetAll("invalid/id"))
        .rejects.toThrow(ValidationError);
    });

    it("should fetch all tasks for project", async () => {
      const mockTasks = {
        tasks: [
          { id: "1", projectId: "p1", title: "Task 1", status: TaskStatus.Active, createdTime: "", modifiedTime: "" },
          { id: "2", projectId: "p1", title: "Task 2", status: TaskStatus.Completed, createdTime: "", modifiedTime: "" }
        ]
      };
      mockRequest.mockResolvedValueOnce(mockTasks);

      const result = await client.tasksGetAll("project-1");

      expect(result).toEqual(mockTasks);
    });
  });

  describe("tasksSearchLocal", () => {
    const mockTasks: Task[] = [
      { id: "1", projectId: "p1", title: "Buy groceries", status: TaskStatus.Active, content: "milk, eggs", createdTime: "", modifiedTime: "" },
      { id: "2", projectId: "p1", title: "Call mom", status: TaskStatus.Active, desc: "weekend", createdTime: "", modifiedTime: "" },
      { id: "3", projectId: "p2", title: "Buy groceries", status: TaskStatus.Completed, createdTime: "", modifiedTime: "" }
    ];

    const mockFetcher = vi.fn();

    it("should throw ValidationError for empty projectIds", async () => {
      await expect(
        client.tasksSearchLocal({ projectIds: [] }, mockFetcher)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for invalid projectIds", async () => {
      await expect(
        client.tasksSearchLocal({ projectIds: ["invalid!"] }, mockFetcher)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for invalid query type", async () => {
      await expect(
        client.tasksSearchLocal({ query: 123 as any, projectIds: ["p1"] }, mockFetcher)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for query too long", async () => {
      const longQuery = "x".repeat(1001);
      await expect(
        client.tasksSearchLocal({ query: longQuery, projectIds: ["p1"] }, mockFetcher)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for too many projectIds", async () => {
      const tooManyIds = Array(101).fill("p1");
      await expect(
        client.tasksSearchLocal({ projectIds: tooManyIds }, mockFetcher)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for invalid status", async () => {
      await expect(
        client.tasksSearchLocal({ status: 99, projectIds: ["p1"] }, mockFetcher)
      ).rejects.toThrow(ValidationError);
    });

    it("should search with query matching title, content, desc", async () => {
      mockFetcher.mockImplementation((projectId: string) => {
        const tasks = mockTasks.filter(t => t.projectId === projectId);
        return Promise.resolve({ tasks });
      });

      const result = await client.tasksSearchLocal(
        { query: "groceries", projectIds: ["p1"] },
        mockFetcher
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe("1");
      expect(result.projectsSearched).toBe(1);
    });

    it("should filter by status", async () => {
      mockFetcher.mockImplementation((projectId: string) => {
        const tasks = mockTasks.filter(t => t.projectId === projectId);
        return Promise.resolve({ tasks });
      });

      const result = await client.tasksSearchLocal(
        { status: TaskStatus.Active, projectIds: ["p1", "p2"] },
        mockFetcher
      );

      expect(result.results).toHaveLength(2);
      expect(result.results.every(t => t.status === TaskStatus.Active)).toBe(true);
    });

    it("should combine query and status filters", async () => {
      mockFetcher.mockImplementation((projectId: string) => {
        const tasks = mockTasks.filter(t => t.projectId === projectId);
        return Promise.resolve({ tasks });
      });

      const result = await client.tasksSearchLocal(
        { query: "groceries", status: TaskStatus.Active, projectIds: ["p1", "p2"] },
        mockFetcher
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe(TaskStatus.Active);
    });

    it("should handle empty results", async () => {
      mockFetcher.mockResolvedValue({ tasks: [] });

      const result = await client.tasksSearchLocal(
        { query: "nonexistent", projectIds: ["p1"] },
        mockFetcher
      );

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should fetch tasks from all projects in parallel", async () => {
      mockFetcher.mockResolvedValue({ tasks: [mockTasks[0]] });

      const result = await client.tasksSearchLocal(
        { projectIds: ["p1", "p2"] },
        mockFetcher
      );

      expect(mockFetcher).toHaveBeenCalledTimes(2);
      expect(result.projectsSearched).toBe(2);
    });

    it("should collect errors from failed fetches", async () => {
      mockFetcher
        .mockResolvedValueOnce({ tasks: [mockTasks[0]] })
        .mockRejectedValueOnce(new Error("Network error"));

      const result = await client.tasksSearchLocal(
        { projectIds: ["p1", "p2"] },
        mockFetcher
      );

      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].projectId).toBe("p2");
    });

    it("should handle empty query gracefully", async () => {
      mockFetcher.mockResolvedValue({ tasks: mockTasks });

      const result = await client.tasksSearchLocal(
        { query: "", projectIds: ["p1"] },
        mockFetcher
      );

      // Empty query should match all tasks
      expect(result.results.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle whitespace-only query", async () => {
      mockFetcher.mockResolvedValue({ tasks: mockTasks });

      const result = await client.tasksSearchLocal(
        { query: "   ", projectIds: ["p1"] },
        mockFetcher
      );

      // Whitespace query should match all tasks (treated as empty)
      expect(result.results.length).toBeGreaterThanOrEqual(1);
    });

    it("should use TaskStatus enum for status filtering", async () => {
      mockFetcher.mockResolvedValue({ tasks: mockTasks });

      const result = await client.tasksSearchLocal(
        { status: TaskStatus.Completed, projectIds: ["p1", "p2"] },
        mockFetcher
      );

      expect(result.results.every(t => t.status === TaskStatus.Completed)).toBe(true);
    });
  });
});
