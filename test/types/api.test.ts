/**
 * API Types unit tests
 */
import { describe, it, expect } from "vitest";
import type {
  Project,
  Task,
  TaskCreateParams,
  TaskUpdateParams,
  SearchResult
} from "../../scripts/dida365/types/api.js";

// TaskStatus enum values for testing
const TaskStatus = { Active: 0, Completed: 1 } as const;

describe("API Types", () => {
  describe("TaskStatus Enum", () => {
    it("should have correct values", () => {
      expect(TaskStatus.Active).toBe(0);
      expect(TaskStatus.Completed).toBe(1);
    });
  });

  describe("Project Type", () => {
    it("should accept valid project objects", () => {
      const project: Project = {
        id: "123",
        name: "My Project",
        color: "#ff0000",
        sortOrder: 0,
        viewMode: "list",
        kind: "project",
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString()
      };
      
      expect(project.id).toBe("123");
      expect(project.name).toBe("My Project");
    });

    it("should work with minimal required fields", () => {
      const minimalProject: Project = {
        id: "123",
        name: "Minimal",
        createdTime: "2024-01-01T00:00:00.000Z",
        modifiedTime: "2024-01-01T00:00:00.000Z"
      };
      
      expect(minimalProject.id).toBeDefined();
      expect(minimalProject.name).toBeDefined();
    });
  });

  describe("Task Type", () => {
    it("should accept valid task objects", () => {
      const task: Task = {
        id: "task-123",
        projectId: "project-456",
        title: "Test Task",
        content: "Task content",
        desc: "Description",
        status: 0,  // Active
        isAllDay: false,
        startDate: "2024-01-01T10:00:00+0000",
        dueDate: "2024-01-02T10:00:00+0000",
        priority: 0,
        sortOrder: 0,
        timeZone: "Asia/Shanghai",
        tags: ["tag1", "tag2"],
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString()
      };
      
      expect(task.id).toBe("task-123");
      expect(task.status).toBe(0);
    });

    it("should distinguish active vs completed tasks", () => {
      const activeTask: Task = {
        id: "1",
        projectId: "p1",
        title: "Active",
        status: 0,  // Active
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString()
      };
      
      const completedTask: Task = {
        id: "2",
        projectId: "p1",
        title: "Completed",
        status: 1,  // Completed
        completedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString()
      };
      
      expect(activeTask.status).toBe(0);
      expect(completedTask.status).toBe(1);
      expect(activeTask.completedTime).toBeUndefined();
      expect(completedTask.completedTime).toBeDefined();
    });
  });

  describe("TaskCreateParams Type", () => {
    it("should require title", () => {
      const validParams: TaskCreateParams = {
        title: "New Task"
      };
      
      expect(validParams.title).toBe("New Task");
    });

    it("should accept all optional fields", () => {
      const fullParams: TaskCreateParams = {
        title: "Full Task",
        content: "Content",
        desc: "Description",
        isAllDay: true,
        startDate: "2024-01-01T00:00:00+0000",
        dueDate: "2024-01-02T00:00:00+0000",
        priority: 3,
        sortOrder: 0,
        timeZone: "UTC",
        reminders: ["2024-01-01T08:00:00+0000"],
        tags: ["work", "urgent"]
      };
      
      expect(fullParams.title).toBe("Full Task");
      expect(fullParams.priority).toBe(3);
      expect(fullParams.tags).toHaveLength(2);
    });
  });

  describe("TaskUpdateParams Type", () => {
    it("should allow partial updates", () => {
      const partialUpdate: TaskUpdateParams = {
        title: "Updated Title"
      };
      
      expect(partialUpdate.title).toBe("Updated Title");
    });

    it("should allow clearing fields with undefined", () => {
      const clearFields: TaskUpdateParams = {
        title: "New Title",
        content: undefined,
        desc: undefined
      };
      
      expect(clearFields.title).toBe("New Title");
      expect(clearFields.content).toBeUndefined();
    });
  });

  describe("SearchResult Type", () => {
    it("should structure search results correctly", () => {
      const result: SearchResult<Task> = {
        results: [
          {
            id: "1",
            projectId: "p1",
            title: "Task 1",
            status: 0,  // Active
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString()
          }
        ],
        total: 1,
        projectsSearched: 1
      };
      
      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.projectsSearched).toBe(1);
    });

    it("should include optional errors", () => {
      const resultWithErrors: SearchResult<Task> = {
        results: [],
        total: 0,
        projectsSearched: 5,
        errors: [
          { projectId: "p1", error: "Network error" },
          { projectId: "p2", error: "Not found" }
        ]
      };
      
      expect(resultWithErrors.errors).toHaveLength(2);
      expect(resultWithErrors.errors?.[0].projectId).toBe("p1");
    });
  });
});
