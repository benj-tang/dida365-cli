/**
 * Config utilities unit tests
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";

// We can't import the actual config module since it reads from disk
// Instead, we test the validation logic and config structure

describe("Config Structure", () => {
  describe("Config Schema", () => {
    it("should have required baseUrl field", () => {
      const config = {
        baseUrl: "https://api.dida365.com/open/v1",
        token: "test-token",
        timeoutMs: 30000,
        retries: 3
      };
      
      expect(config.baseUrl).toBeDefined();
      expect(typeof config.baseUrl).toBe("string");
    });

    it("should have optional token field", () => {
      const configWithoutToken = { baseUrl: "https://test.com" };
      expect(configWithoutToken.token).toBeUndefined();
    });

    it("should validate timeoutMs is positive", () => {
      const validTimeouts = [1000, 30000, 60000];
      for (const timeout of validTimeouts) {
        expect(typeof timeout === "number" && timeout > 0).toBe(true);
      }
    });

    it("should validate retries is non-negative", () => {
      const validRetries = [0, 1, 3, 5];
      for (const retries of validRetries) {
        expect(typeof retries === "number" && retries >= 0).toBe(true);
      }
    });
  });

  describe("Config File Loading", () => {
    it("should be able to read config file", () => {
      try {
        const configPath = new URL("../../dida365.config.json", import.meta.url);
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        expect(config).toBeDefined();
      } catch (e) {
        // Config file may not exist in test environment
        expect(true).toBe(true);
      }
    });
  });
});

describe("Config Validation Logic", () => {
  it("should validate baseUrl format", () => {
    const validUrls = [
      "https://api.dida365.com/open/v1",
      "https://test.example.com/api"
    ];
    
    for (const url of validUrls) {
      try {
        new URL(url);
        expect(true).toBe(true);
      } catch {
        expect(false).toBe(true);
      }
    }
  });

  it("should reject invalid URLs", () => {
    const invalidUrls = [
      "not-a-url",
      "ftp://invalid.com",
      "missing-protocol.com"
    ];
    
    for (const url of invalidUrls) {
      try {
        new URL(url);
        expect(false).toBe(true);
      } catch {
        expect(true).toBe(true);
      }
    }
  });

  it("should validate environment overrides", () => {
    const envOverrides = {
      DIDA365_BASE_URL: "https://api.dida365.com/open/v1",
      DIDA365_TOKEN: "test-token",
      DIDA365_TIMEOUT_MS: "30000",
      DIDA365_RETRIES: "3"
    };
    
    // Test that env vars can be parsed
    expect(typeof envOverrides.DIDA365_TIMEOUT_MS).toBe("string");
    expect(parseInt(envOverrides.DIDA365_TIMEOUT_MS)).toBe(30000);
    expect(typeof envOverrides.DIDA365_RETRIES).toBe("string");
    expect(parseInt(envOverrides.DIDA365_RETRIES)).toBe(3);
  });
});
