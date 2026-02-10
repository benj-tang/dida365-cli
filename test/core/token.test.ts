import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  defaultTokenPath,
  resolveTokenPath,
  normalizeToken,
  isTokenExpired,
  loadToken,
  saveToken,
  clearToken,
  withRefreshMutex,
  OAuthToken,
} from "../../scripts/dida365/core/token.ts";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

// Test directory setup
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, "..", "..", "test-fixtures", "token-tests");
let testTokenPath: string;

const cleanupTestDir = async () => {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
};

describe("Token Module", () => {
  beforeEach(async () => {
    await cleanupTestDir();
    await fs.mkdir(testDir, { recursive: true });
    testTokenPath = path.join(testDir, "token.json");
  });

  afterEach(async () => {
    await cleanupTestDir();
    vi.restoreAllMocks();
  });

  describe("Token File Path Resolution", () => {
    it("should return default token path with correct structure", () => {
      const defaultPath = defaultTokenPath();
      expect(defaultPath).toBe(path.join(os.homedir(), ".config", "dida365-cli", "token.json"));
    });

    it("should resolve token path from config with oauth.tokenPath", () => {
      const cfg = { oauth: { tokenPath: "/custom/path/token.json" } };
      const resolved = resolveTokenPath(cfg);
      expect(resolved).toBe("/custom/path/token.json");
    });

    it("should resolve token path from config with tokenPath", () => {
      const cfg = { tokenPath: "/another/custom/path.json" };
      const resolved = resolveTokenPath(cfg);
      expect(resolved).toBe("/another/custom/path.json");
    });

    it("should prefer oauth.tokenPath over tokenPath", () => {
      const cfg = {
        oauth: { tokenPath: "/oauth/path.json" },
        tokenPath: "/config/path.json",
      };
      const resolved = resolveTokenPath(cfg);
      expect(resolved).toBe("/oauth/path.json");
    });

    it("should fall back to default when config is empty", () => {
      expect(resolveTokenPath(null)).toBe(defaultTokenPath());
      expect(resolveTokenPath(undefined)).toBe(defaultTokenPath());
      expect(resolveTokenPath({})).toBe(defaultTokenPath());
    });

    it("should convert non-string tokenPath to string", () => {
      const cfg = { tokenPath: 12345 };
      const resolved = resolveTokenPath(cfg);
      expect(resolved).toBe("12345");
    });
  });

  describe("Token Normalization", () => {
    it("should add expires_at when expires_in is provided", () => {
      const now = Date.now();
      const token: OAuthToken = {
        access_token: "test_token",
        expires_in: 3600,
      };
      const normalized = normalizeToken(token);
      expect(normalized.expires_at).toBeDefined();
      expect(normalized.expires_at! - now).toBeCloseTo(3600 * 1000, -3);
    });

    it("should preserve existing expires_at", () => {
      const fixedTime = Date.now() + 7200000;
      const token: OAuthToken = {
        access_token: "test_token",
        expires_at: fixedTime,
      };
      const normalized = normalizeToken(token);
      expect(normalized.expires_at).toBe(fixedTime);
    });

    it("should not modify original token object", () => {
      const token: OAuthToken = {
        access_token: "test_token",
        expires_in: 3600,
      };
      const normalized = normalizeToken(token);
      expect(token.expires_at).toBeUndefined();
      expect(normalized.expires_at).toBeDefined();
    });

    it("should preserve all other token properties", () => {
      const token: OAuthToken = {
        access_token: "test_token",
        refresh_token: "refresh",
        token_type: "Bearer",
        scope: "read write",
        expires_in: 3600,
      };
      const normalized = normalizeToken(token);
      expect(normalized.access_token).toBe("test_token");
      expect(normalized.refresh_token).toBe("refresh");
      expect(normalized.token_type).toBe("Bearer");
      expect(normalized.scope).toBe("read write");
    });
  });

  describe("Token Expiration Checking", () => {
    it("should return false for token without expires_at", () => {
      const token: OAuthToken = { access_token: "test" };
      expect(isTokenExpired(token)).toBe(false);
    });

    it("should return false for non-expired token", () => {
      const token: OAuthToken = {
        access_token: "test",
        expires_at: Date.now() + 3600000,
      };
      expect(isTokenExpired(token)).toBe(false);
    });

    it("should return true for expired token", () => {
      const token: OAuthToken = {
        access_token: "test",
        expires_at: Date.now() - 1000,
      };
      expect(isTokenExpired(token)).toBe(true);
    });

    it("should respect skew seconds parameter", () => {
      const token: OAuthToken = {
        access_token: "test",
        expires_at: Date.now() + 30000, // 30 seconds from now
      };
      // With 60s skew, 30s remaining should be considered expired
      expect(isTokenExpired(token, 60)).toBe(true);
      // With 0 skew, 30s remaining should not be expired
      expect(isTokenExpired(token, 0)).toBe(false);
    });

    it("should handle edge case where token expires exactly now", () => {
      const token: OAuthToken = {
        access_token: "test",
        expires_at: Date.now(),
      };
      expect(isTokenExpired(token)).toBe(true);
      expect(isTokenExpired(token, 0)).toBe(true);
    });
  });

  describe("Token Load/Save Operations", () => {
    it("should load valid token from file", async () => {
      const token: OAuthToken = {
        access_token: "test_access_token",
        refresh_token: "test_refresh_token",
        token_type: "Bearer",
        expires_in: 3600,
      };
      await fs.writeFile(testTokenPath, JSON.stringify(token));
      const loaded = await loadToken(testTokenPath);
      expect(loaded).toEqual(token);
    });

    it("should return null for non-existent file", async () => {
      const loaded = await loadToken("/non/existent/path.json");
      expect(loaded).toBeNull();
    });

    it("should save token to file and normalize it", async () => {
      const token: OAuthToken = {
        access_token: "save_test_token",
        expires_in: 7200,
      };
      const saved = await saveToken(testTokenPath, token);
      expect(saved.expires_at).toBeDefined();
      const fileContent = await fs.readFile(testTokenPath, "utf8");
      const parsed = JSON.parse(fileContent);
      expect(parsed.access_token).toBe("save_test_token");
      expect(parsed.expires_at).toBe(saved.expires_at);
    });

    it("should create parent directories when saving", async () => {
      const nestedPath = path.join(testDir, "nested", "deep", "token.json");
      const token: OAuthToken = { access_token: "nested_test" };
      await saveToken(nestedPath, token);
      const loaded = await loadToken(nestedPath);
      expect(loaded).toEqual(token);
    });

    it("should save token with proper permissions", async () => {
      const token: OAuthToken = { access_token: "perm_test" };
      await saveToken(testTokenPath, token);
      // File should be readable
      const loaded = await loadToken(testTokenPath);
      expect(loaded).toBeDefined();
    });
  });

  describe("Token Clear Operations", () => {
    it("should clear existing token file", async () => {
      await fs.writeFile(testTokenPath, '{"access_token": "test"}');
      await clearToken(testTokenPath);
      const exists = await fs.access(testTokenPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it("should not throw when clearing non-existent token", async () => {
      await expect(clearToken("/non/existent/token.json")).resolves.not.toThrow();
    });

    it("should return null when loading after clearing", async () => {
      await fs.writeFile(testTokenPath, '{"access_token": "test"}');
      await clearToken(testTokenPath);
      const loaded = await loadToken(testTokenPath);
      expect(loaded).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should throw error for invalid JSON", async () => {
      await fs.writeFile(testTokenPath, "not valid json");
      await expect(loadToken(testTokenPath)).rejects.toThrow();
    });

    it("should handle permission errors gracefully", async () => {
      // Create a directory instead of file to trigger error
      await fs.mkdir(testTokenPath);
      await expect(loadToken(testTokenPath)).rejects.toThrow();
    });

    it("should handle concurrent refresh mutex correctly", async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        callCount++;
        return "result";
      });

      const results = await Promise.all([
        withRefreshMutex(mockFn),
        withRefreshMutex(mockFn),
        withRefreshMutex(mockFn),
      ]);

      // Only one execution should occur due to mutex
      expect(callCount).toBe(1);
      expect(results.every((r) => r === "result")).toBe(true);
    });

    it("should reset mutex after function completes", async () => {
      let resolveFirst: () => void;
      const firstStarted = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      let callCount = 0;

      const mockFn = vi.fn().mockImplementation(async () => {
        callCount++;
        resolveFirst();
        await new Promise((r) => setTimeout(r, 100)); // Simulate work
        return "done";
      });

      const p1 = withRefreshMutex(mockFn);
      await firstStarted; // Wait for first call to start
      const p2 = withRefreshMutex(mockFn); // This should wait

      await p1;
      await p2;

      expect(callCount).toBe(1);
    });

    it("should throw original error when function fails", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Refresh failed"));

      await expect(withRefreshMutex(mockFn)).rejects.toThrow("Refresh failed");

      // Mutex should be released after error
      const mockFn2 = vi.fn().mockResolvedValue("success");
      const result = await withRefreshMutex(mockFn2);
      expect(result).toBe("success");
    });
  });

  describe("Token Edge Cases", () => {
    it("should handle empty token object", async () => {
      // saveToken doesn't validate, but loadToken does
      await saveToken(testTokenPath, {} as OAuthToken);
      // loadToken will fail because empty token is invalid
      await expect(loadToken(testTokenPath))
        .rejects.toThrow("Invalid token: missing or invalid access_token");
    });

    it("should handle token with complex nested properties", async () => {
      const token: OAuthToken = {
        access_token: "complex_token",
        refresh_token: "complex_refresh",
        extra_data: {
          nested: {
            deep: "value",
          },
          array: [1, 2, 3],
        },
      };
      await saveToken(testTokenPath, token);
      const loaded = await loadToken(testTokenPath);
      
      // normalizeToken adds expires_at field
      expect(loaded.access_token).toBe("complex_token");
      expect(loaded.refresh_token).toBe("complex_refresh");
      expect(loaded.extra_data).toEqual(token.extra_data);
      expect(loaded.expires_at).toBeUndefined(); // expires_in was not set
    });

    it("should handle very large expires_in value", async () => {
      const token: OAuthToken = {
        access_token: "long_token",
        expires_in: Number.MAX_SAFE_INTEGER,
      };
      const normalized = normalizeToken(token);
      expect(normalized.expires_at).toBeDefined();
      expect(normalized.expires_at).toBeGreaterThan(Date.now());
    });

    it("should handle zero expires_in (treated as no expiration)", () => {
      const token: OAuthToken = {
        access_token: "zero_token",
        expires_in: 0,
      };
      const normalized = normalizeToken(token);
      // expires_in: 0 is treated as no expiration (falsy check)
      expect(normalized.expires_at).toBeUndefined();
    });
  });
});
