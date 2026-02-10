import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { Cache } from "../../scripts/dida365/core/cache.js";
import { tmpdir } from "node:os";

describe("Cache", () => {
  let cache: Cache;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(tmpdir(), `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cache = new Cache({
      dir: testDir,
      ttlMs: 1000,
      staleIfErrorMs: 500
    });
  });

  afterEach(async () => {
    await cache.purge().catch(() => {});
  });

  describe("Cache get/set/delete operations", () => {
    it("should set and get a value from cache", async () => {
      await cache.set("key1", { name: "test" });
      const result = await cache.get("key1");
      expect(result.source).toBe("memory");
      expect(result.entry?.value).toEqual({ name: "test" });
    });

    it("should persist values to disk", async () => {
      await cache.set("diskKey", "diskValue");
      // Clear memory cache
      (cache as any).mem.clear();
      // Should still retrieve from disk
      const result = await cache.get("diskKey");
      expect(result.source).toBe("disk");
      expect(result.entry?.value).toBe("diskValue");
    });

    it("should return null source for missing keys", async () => {
      const result = await cache.get("nonexistent");
      expect(result.source).toBeNull();
      expect(result.entry).toBeUndefined();
    });

    it("should handle multiple keys independently", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      expect((await cache.get("key1")).entry?.value).toBe("value1");
      expect((await cache.get("key2")).entry?.value).toBe("value2");
      expect((await cache.get("key3")).entry?.value).toBe("value3");
    });

    it("should override existing values", async () => {
      await cache.set("key", "original");
      await cache.set("key", "updated");

      const result = await cache.get("key");
      expect(result.entry?.value).toBe("updated");
    });

    it("should invalidate (delete) a key", async () => {
      await cache.set("toDelete", "value");
      await cache.invalidate("toDelete");

      const result = await cache.get("toDelete");
      expect(result.source).toBeNull();
      expect(result.entry).toBeUndefined();
    });

    it("should handle invalidating non-existent keys gracefully", async () => {
      await cache.invalidate("nonexistent").catch(() => {});
      const result = await cache.get("nonexistent");
      expect(result.source).toBeNull();
    });

    it("should store complex objects", async () => {
      const complexValue = {
        nested: { deep: { value: 42 } },
        array: [1, 2, 3],
        string: "test",
        number: 123.456,
        boolean: true
      };
      await cache.set("complex", complexValue);
      const result = await cache.get("complex");
      expect(result.entry?.value).toEqual(complexValue);
    });
  });

  describe("TTL expiration", () => {
    it("should return fresh (non-stale) entry within TTL", async () => {
      await cache.set("freshKey", "freshValue");
      const result = await cache.get("freshKey");
      expect(result.stale).toBe(false);
    });

    it("should return stale entry after TTL expires", async () => {
      await cache.set("staleKey", "staleValue", 50); // 50ms TTL
      await new Promise(resolve => setTimeout(resolve, 60)); // Wait for expiration

      const result = await cache.get("staleKey");
      expect(result.stale).toBe(true);
      expect(result.entry?.value).toBe("staleValue");
    });

    it("should use default TTL when not specified", async () => {
      await cache.set("defaultTTL", "value");
      await new Promise(resolve => setTimeout(resolve, 1100)); // Default is 1000ms

      const result = await cache.get("defaultTTL");
      expect(result.stale).toBe(true);
    });

    it("should allow custom TTL per set operation", async () => {
      await cache.set("customTTL", "value", 5000);
      await new Promise(resolve => setTimeout(resolve, 100)); // Should still be fresh

      const result = await cache.get("customTTL");
      expect(result.stale).toBe(false);
    });

    it("should track cachedAt and expiresAt timestamps", async () => {
      const beforeSet = Date.now();
      await cache.set("timestamp", "value", 1000);
      const afterSet = Date.now();

      const result = await cache.get("timestamp");
      expect(result.entry?.cachedAt).toBeGreaterThanOrEqual(beforeSet);
      expect(result.entry?.cachedAt).toBeLessThanOrEqual(afterSet);
      expect(result.entry?.expiresAt).toBe(result.entry?.cachedAt + 1000);
    });

    it("should expire stale entries from memory but keep disk copy", async () => {
      await cache.set("staleMem", "value", 50);
      await new Promise(resolve => setTimeout(resolve, 60));

      const result = await cache.get("staleMem");
      expect(result.stale).toBe(true);
      // Value should still be accessible
      expect(result.entry?.value).toBe("value");
    });

    it("should support fetch with TTL option", async () => {
      const fetcher = vi.fn().mockResolvedValue("fetchedValue");
      const result = await cache.fetch("fetchKey", fetcher, { ttlMs: 2000 });

      expect(result.value).toBe("fetchedValue");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling for missing/invalid cache", () => {
    it("should handle non-existent file reads gracefully", async () => {
      const result = await cache.get("totallyNewKey");
      expect(result.source).toBeNull();
      expect(result.stale).toBe(false);
    });

    it("should return stale cache on fetch error within staleIfErrorMs window", async () => {
      // First, set a valid cache entry
      await cache.set("errorKey", "cachedValue", 50);
      await new Promise(resolve => setTimeout(resolve, 60)); // Let it expire

      const fetcher = vi.fn().mockRejectedValue(new Error("Network error"));
      const result = await cache.fetch("errorKey", fetcher);

      expect(result.stale).toBe(true);
      expect(result.value).toBe("cachedValue");
      expect(result.error).toBeDefined();
    });

    it("should throw error when fetch fails and no stale cache available", async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(cache.fetch("noCacheKey", fetcher)).rejects.toThrow("Network error");
    });

    it("should re-throw errors beyond staleIfErrorMs window", async () => {
      // Set cache with very short TTL
      await cache.set("expiredKey", "oldValue", 50);
      // Wait for both TTL and staleIfErrorMs to pass
      await new Promise(resolve => setTimeout(resolve, 600));

      const fetcher = vi.fn().mockRejectedValue(new Error("Persistent error"));

      await expect(cache.fetch("expiredKey", fetcher)).rejects.toThrow("Persistent error");
    });

    it("should handle JSON parse errors in disk cache", async () => {
      const filePath = (cache as any).fileForKey("badJson");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, "{invalid json", "utf8");

      const result = await cache.get("badJson");
      expect(result.source).toBeNull();
    });

    it("should handle disk read permission errors gracefully", async () => {
      // This test verifies error handling without actually testing permissions
      const readDiskSpy = vi.spyOn(Cache.prototype as any, "readDisk");
      readDiskSpy.mockRejectedValueOnce(new Error("EACCES: permission denied"));

      await cache.set("permKey", "value");
      (cache as any).mem.clear();

      const result = await cache.get("permKey");
      expect(result.source).toBeNull();
    });

    it("should handle invalid key mismatches", async () => {
      const filePath = (cache as any).fileForKey("correctKey");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      // Write cache with wrong key
      await fs.writeFile(
        filePath,
        JSON.stringify({ key: "wrongKey", value: "test", cachedAt: Date.now(), expiresAt: Date.now() + 1000 }),
        "utf8"
      );

      const result = await cache.get("correctKey");
      expect(result.source).toBeNull();
    });

    it("should handle unlink errors gracefully during invalidate", async () => {
      await cache.set("unlinkKey", "value");
      
      // Verify key is in cache
      expect((await cache.get("unlinkKey")).source).toBe("memory");
      
      // Mock unlink to throw error (non-ENOENT)
      const unlinkSpy = vi.spyOn(fs, "unlink").mockRejectedValueOnce(new Error("EBUSY"));
      
      // Invalidate should throw because error is not ENOENT
      try {
        await cache.invalidate("unlinkKey");
      } catch (e) {
        // Expected - error should propagate
      }
      
      // Memory should be cleared
      const getResult = await cache.get("unlinkKey");
      // Since unlink failed, disk file still exists, so get will read from disk
      expect(getResult.source).toBe("disk");
    });
  });

  describe("Stats calculation", () => {
    it("should return correct stats for empty cache", async () => {
      const stats = await cache.stats();
      expect(stats.dir).toBe(testDir);
      expect(stats.files).toBe(0);
      expect(stats.memoryEntries).toBe(0);
      expect(stats.ttlMs).toBe(1000);
      expect(stats.staleIfErrorMs).toBe(500);
    });

    it("should track memory entries count correctly", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const stats = await cache.stats();
      expect(stats.memoryEntries).toBe(3);
    });

    it("should track disk files count correctly", async () => {
      await cache.set("file1", "value1");
      await cache.set("file2", "value2");

      // Clear memory to verify disk count
      (cache as any).mem.clear();
      const stats = await cache.stats();
      expect(stats.files).toBe(2);
    });

    it("should update stats after invalidation", async () => {
      await cache.set("statsKey", "value");
      const beforeStats = await cache.stats();
      expect(beforeStats.memoryEntries).toBe(1);

      await cache.invalidate("statsKey");
      const afterStats = await cache.stats();
      expect(afterStats.memoryEntries).toBe(0);
    });

    it("should include TTL configuration in stats", async () => {
      const customCache = new Cache({
        dir: testDir,
        ttlMs: 5000,
        staleIfErrorMs: 3000
      });
      const stats = await customCache.stats();
      expect(stats.ttlMs).toBe(5000);
      expect(stats.staleIfErrorMs).toBe(3000);
    });

    it("should handle stats on non-existent directory", async () => {
      const emptyCache = new Cache({
        dir: path.join(tmpdir(), "nonexistent-dir-" + Date.now()),
        ttlMs: 1000,
        staleIfErrorMs: 500
      });
      const stats = await emptyCache.stats();
      expect(stats.files).toBe(0);
      expect(stats.memoryEntries).toBe(0);
    });

    it("should return accurate count after purge", async () => {
      await cache.set("purge1", "value");
      await cache.set("purge2", "value");
      await cache.purge();

      const stats = await cache.stats();
      expect(stats.files).toBe(0);
      expect(stats.memoryEntries).toBe(0);
    });
  });

  describe("Fetch functionality", () => {
    it("should return cached value from origin fetch", async () => {
      let callCount = 0;
      const fetcher = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve("fetched");
      });

      // First call should fetch
      const result1 = await cache.fetch("fetchTest", fetcher);
      expect(result1.source).toBe("origin");
      expect(result1.stale).toBe(false);
      expect(callCount).toBe(1);

      // Second call should use cache
      const result2 = await cache.fetch("fetchTest", fetcher);
      expect(result2.source).toBe("cache");
      expect(result2.stale).toBe(false);
      expect(callCount).toBe(1);
    });

    it("should return stale cache with error when origin fails", async () => {
      // Create cache with short TTL
      const cacheWithShortTtl = new Cache({
        dir: testDir,
        ttlMs: 10, // 10ms TTL
        staleIfErrorMs: 86400000 // 24 hours stale
      });
      
      // Set cache entry
      await cacheWithShortTtl.set("errorFetch", "cached");
      
      // Wait for cache to expire (longer than TTL)
      await new Promise(r => setTimeout(r, 50));
      
      // Verify cache is expired by checking get directly
      const getResult = await cacheWithShortTtl.get("errorFetch");
      console.log("getResult:", JSON.stringify(getResult));
      
      const fetcher = vi.fn().mockRejectedValue(new Error("Failed"));
      const result = await cacheWithShortTtl.fetch("errorFetch", fetcher);
      console.log("fetchResult:", JSON.stringify(result));

      expect(result.stale).toBe(true);
      expect(result.value).toBe("cached");
      expect(result.error).toBeDefined();
    });
  });

  describe("Purge functionality", () => {
    it("should clear both memory and disk cache", async () => {
      await cache.set("purgeKey", "purgeValue");
      expect((await cache.get("purgeKey")).source).toBe("memory");

      await cache.purge();
      expect((await cache.get("purgeKey")).source).toBeNull();

      // Verify disk is cleared
      const stats = await cache.stats();
      expect(stats.files).toBe(0);
    });

    it("should handle purge on non-existent directory", async () => {
      const emptyCache = new Cache({
        dir: path.join(tmpdir(), "never-existed-" + Date.now()),
        ttlMs: 1000,
        staleIfErrorMs: 500
      });
      await expect(emptyCache.purge()).resolves.not.toThrow();
    });
  });
});
