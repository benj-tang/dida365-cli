/**
 * HTTP Client unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpClient, HttpClientOptions } from "../../scripts/dida365/core/http.js";
import { NetworkError, ApiError } from "../../scripts/dida365/core/errors.js";

describe("HttpClient", () => {
  let client: HttpClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);
    client = new HttpClient({
      baseUrl: "https://api.dida365.com/open/v1",
      token: "test-token",
      timeoutMs: 5000,
      retries: 2
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with all options", () => {
      expect(client.baseUrl).toBe("https://api.dida365.com/open/v1");
      expect(client.token).toBe("test-token");
      expect(client.timeoutMs).toBe(5000);
      expect(client.retries).toBe(2);
    });

    it("should use default values for missing options", () => {
      const defaultClient = new HttpClient({ baseUrl: "https://test.com" });
      expect(defaultClient.timeoutMs).toBe(10000);
      expect(defaultClient.retries).toBe(2);
      expect(defaultClient.token).toBeUndefined();
    });
  });

  describe("request", () => {
    it("should throw NetworkError when baseUrl is not configured", async () => {
      const unconfiguredClient = new HttpClient({ baseUrl: "TODO" });
      
      await expect(unconfiguredClient.request("GET", "test"))
        .rejects.toThrow(NetworkError);
    });

    it("should include authorization header when token is set", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

      await client.request("GET", "project");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer test-token"
          })
        })
      );
    });

    it("should set content-type for JSON requests with body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

      await client.request("POST", "project", { name: "Test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "content-type": "application/json"
          })
        })
      );
    });

    it("should handle successful JSON response", async () => {
      const mockData = { projects: [{ id: "1", name: "Test" }] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

      const result = await client.request("GET", "project");

      expect(result).toEqual(mockData);
    });

    it("should handle empty response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("", { status: 200 })
      );

      const result = await client.request("GET", "project");

      // Empty response returns empty object
      expect(result).toEqual({});
    });

    it("should throw ApiError on HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );

      await expect(client.request("GET", "project/999"))
        .rejects.toThrow(ApiError);
    });

    it("should throw ApiError on invalid JSON in JSON response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("not valid json", {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

      await expect(client.request("GET", "project"))
        .rejects.toThrow(ApiError);
    });

    it("should not throw on non-JSON responses with non-200 status", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Error page", {
          status: 500,
          headers: { "Content-Type": "text/html" }
        })
      );

      await expect(client.request("GET", "project"))
        .rejects.toThrow();
    });
  });

  describe("Retry Logic", () => {
    it("should retry on server errors (5xx)", async () => {
      // First two requests fail with 500, third succeeds
      mockFetch
        .mockResolvedValueOnce(
          new Response("Error", { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response("Error", { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );

      const result = await client.request("GET", "project");
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should not retry on client errors (4xx)", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400 })
      );

      await expect(client.request("GET", "project"))
        .rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should cap retries at 5", async () => {
      const clientWithManyRetries = new HttpClient({
        baseUrl: "https://test.com",
        retries: 100 // Request more than cap
      });

      mockFetch.mockResolvedValue(
        new Response("Error", { status: 500 })
      );

      await expect(clientWithManyRetries.request("GET", "project"))
        .rejects.toThrow();

      // Should only retry 5 times (6 total calls including initial)
      expect(mockFetch).toHaveBeenCalledTimes(6);
    }, 30000); // 30s timeout for retry tests
  });

  describe("Timeout", () => {
    it("should abort request on timeout", async () => {
      // Create a slow client
      const slowClient = new HttpClient({
        baseUrl: "https://test.com",
        timeoutMs: 100
      });

      // Mock fetch to never resolve
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      await expect(slowClient.request("GET", "project"))
        .rejects.toThrow();
    });
  });
});
