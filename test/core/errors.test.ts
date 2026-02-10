/**
 * Error classes unit tests
 */
import { describe, it, expect } from "vitest";
import {
  Dida365Error,
  ValidationError,
  NotFoundError,
  NetworkError,
  ApiError
} from "../../scripts/dida365/core/errors.js";

describe("Error Classes", () => {
  describe("Dida365Error", () => {
    it("should create error with message and code", () => {
      const error = new Dida365Error("Test error", "TEST_CODE");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("Dida365Error");
    });

    it("should include optional properties", () => {
      const cause = new Error("Original error");
      const error = new Dida365Error("Test error", "TEST_CODE", 400, "/test", cause);
      expect(error.statusCode).toBe(400);
      expect(error.path).toBe("/test");
      expect(error.cause).toBe(cause);
    });
  });

  describe("ValidationError", () => {
    it("should create validation error with field", () => {
      const error = new ValidationError("Name is required", "name");
      expect(error.message).toBe("Name is required");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe("name");
      expect(error.name).toBe("ValidationError");
    });

    it("should work without field", () => {
      const error = new ValidationError("Invalid input");
      expect(error.field).toBeUndefined();
    });
  });

  describe("NotFoundError", () => {
    it("should create not found error", () => {
      const error = new NotFoundError("Task", "123");
      expect(error.message).toBe("Task not found: 123");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.statusCode).toBe(404);
      expect(error.path).toBe("Task/123");
      expect(error.name).toBe("NotFoundError");
    });
  });

  describe("NetworkError", () => {
    it("should create network error with optional cause", () => {
      const cause = new Error("Connection refused");
      const error = new NetworkError("Network failed", cause);
      expect(error.message).toBe("Network failed");
      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.cause).toBe(cause);
      expect(error.name).toBe("NetworkError");
    });

    it("should work without cause", () => {
      const error = new NetworkError("Network failed");
      expect(error.cause).toBeUndefined();
    });
  });

  describe("ApiError", () => {
    it("should create API error with status", () => {
      const error = new ApiError("Server Error", 500, "/api", { field: "error" });
      expect(error.message).toBe("API returned HTTP 500: Server Error");
      expect(error.code).toBe("API_ERROR");
      expect(error.statusCode).toBe(500);
      expect(error.path).toBe("/api");
    });

    it("should hide error details in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      
      const error = new ApiError("Server Error", 500, "/api", { sensitive: "data" });
      expect((error as any).details).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    it("should show error details in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      
      const error = new ApiError("Server Error", 500, "/api", { field: "value" });
      expect((error as any).details).toEqual({ field: "value" });
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Error inheritance", () => {
    it("should be instance of Error", () => {
      expect(new Dida365Error("", "")).toBeInstanceOf(Error);
      expect(new ValidationError("")).toBeInstanceOf(Error);
      expect(new NotFoundError("", "")).toBeInstanceOf(Error);
      expect(new NetworkError("")).toBeInstanceOf(Error);
      expect(new ApiError("", 500)).toBeInstanceOf(Error);
    });

    it("should be instance of Dida365Error", () => {
      expect(new ValidationError("")).toBeInstanceOf(Dida365Error);
      expect(new NotFoundError("", "")).toBeInstanceOf(Dida365Error);
      expect(new NetworkError("")).toBeInstanceOf(Dida365Error);
      expect(new ApiError("", 500)).toBeInstanceOf(Dida365Error);
    });

    it("should have stack traces", () => {
      const error = new Dida365Error("Test", "TEST");
      expect(error.stack).toBeDefined();
    });
  });
});
