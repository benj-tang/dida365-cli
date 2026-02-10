/**
 * OAuth module unit tests - Simplified version focusing on config validation
 */
import { describe, it, expect } from "vitest";
import {
  OAuthConfig,
  createPkcePair,
  randomState,
  buildAuthorizeUrl
} from "../../scripts/dida365/core/oauth.js";

describe("OAuthConfig Type Validation", () => {
  describe("Required fields", () => {
    it("should accept config with all required fields", () => {
      const config: OAuthConfig = {
        clientId: "test-client-id",
        authorizeUrl: "https://dida365.com/oauth/authorize",
        tokenUrl: "https://dida365.com/oauth/token",
        redirectUri: "http://localhost:8080/callback"
      };
      
      expect(config.clientId).toBe("test-client-id");
      expect(config.authorizeUrl).toBe("https://dida365.com/oauth/authorize");
      expect(config.tokenUrl).toBe("https://dida365.com/oauth/token");
      expect(config.redirectUri).toBe("http://localhost:8080/callback");
    });

    it("should accept config with clientSecret", () => {
      const config: OAuthConfig = {
        clientId: "test-client-id",
        authorizeUrl: "https://dida365.com/oauth/authorize",
        tokenUrl: "https://dida365.com/oauth/token",
        redirectUri: "http://localhost:8080/callback",
        clientSecret: "secret-value"
      };
      
      expect(config.clientSecret).toBe("secret-value");
    });

    it("should accept config with optional scope", () => {
      const config: OAuthConfig = {
        clientId: "test-client-id",
        authorizeUrl: "https://dida365.com/oauth/authorize",
        tokenUrl: "https://dida365.com/oauth/token",
        redirectUri: "http://localhost:8080/callback",
        scope: "tasks:read tasks:write"
      };
      
      expect(config.scope).toBe("tasks:read tasks:write");
    });

    it("should accept config with openBrowser option", () => {
      const config: OAuthConfig = {
        clientId: "test-client-id",
        authorizeUrl: "https://dida365.com/oauth/authorize",
        tokenUrl: "https://dida365.com/oauth/token",
        redirectUri: "http://localhost:8080/callback",
        openBrowser: false
      };
      
      expect(config.openBrowser).toBe(false);
    });

    it("should accept config with callbackTimeoutMs option", () => {
      const config: OAuthConfig = {
        clientId: "test-client-id",
        authorizeUrl: "https://dida365.com/oauth/authorize",
        tokenUrl: "https://dida365.com/oauth/token",
        redirectUri: "http://localhost:8080/callback",
        callbackTimeoutMs: 60000
      };
      
      expect(config.callbackTimeoutMs).toBe(60000);
    });

    it("should allow undefined for optional fields", () => {
      const config: OAuthConfig = {
        clientId: "test-client-id",
        authorizeUrl: "https://dida365.com/oauth/authorize",
        tokenUrl: "https://dida365.com/oauth/token",
        redirectUri: "http://localhost:8080/callback"
      };
      
      expect(config.clientSecret).toBeUndefined();
      expect(config.scope).toBeUndefined();
      expect(config.openBrowser).toBeUndefined();
      expect(config.callbackTimeoutMs).toBeUndefined();
    });
  });

  describe("Type constraints", () => {
    it("should handle different redirectUri formats", () => {
      const config1: OAuthConfig = {
        clientId: "test-client",
        authorizeUrl: "https://auth.example.com/authorize",
        tokenUrl: "https://auth.example.com/token",
        redirectUri: "http://127.0.0.1:3000/auth/callback"
      };
      
      const config2: OAuthConfig = {
        clientId: "test-client",
        authorizeUrl: "https://auth.example.com/authorize",
        tokenUrl: "https://auth.example.com/token",
        redirectUri: "https://myapp.example.com/oauth/redirect"
      };
      
      expect(config1.redirectUri).toMatch(/^http:\/\//);
      expect(config2.redirectUri).toMatch(/^https:\/\//);
    });
  });
});

describe("PKCE Functions", () => {
  describe("createPkcePair", () => {
    it("should generate PKCE pair without throwing", () => {
      expect(() => createPkcePair()).not.toThrow();
    });

    it("should generate PKCE pair with verifier and challenge", () => {
      const pair = createPkcePair();
      
      expect(pair.verifier).toBeDefined();
      expect(pair.challenge).toBeDefined();
      expect(pair.method).toBe("S256");
    });

    it("should generate different pairs on each call", () => {
      const pair1 = createPkcePair();
      const pair2 = createPkcePair();
      
      expect(pair1.verifier).not.toBe(pair2.verifier);
      expect(pair1.challenge).not.toBe(pair2.challenge);
    });

    it("should have correct base64url character set", () => {
      const { verifier, challenge } = createPkcePair();
      
      // Should not contain +, /, or =
      expect(verifier).not.toMatch(/[\+\/=]/);
      expect(challenge).not.toMatch(/[\+\/=]/);
      
      // Should only contain URL-safe base64 characters
      expect(verifier).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(challenge).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe("randomState", () => {
    it("should generate random state without throwing", () => {
      expect(() => randomState()).not.toThrow();
    });

    it("should generate random state with default length", () => {
      const state = randomState();
      
      expect(state).toBeDefined();
      expect(state.length).toBeGreaterThan(0);
    });

    it("should generate random state with custom length", () => {
      const state8 = randomState(8);
      const state32 = randomState(32);
      
      expect(state8.length).toBeGreaterThan(0);
      expect(state32.length).toBeGreaterThan(0);
    });

    it("should generate different states on each call", () => {
      const state1 = randomState();
      const state2 = randomState();
      
      expect(state1).not.toBe(state2);
    });

    it("should use URL-safe base64 characters", () => {
      const state = randomState();
      
      expect(state).not.toMatch(/[\+\/=]/);
      expect(state).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });
});

describe("buildAuthorizeUrl", () => {
  const baseConfig: OAuthConfig = {
    clientId: "test-client-123",
    authorizeUrl: "https://dida365.com/oauth/authorize",
    tokenUrl: "https://dida365.com/oauth/token",
    redirectUri: "http://localhost:8080/callback",
    scope: "tasks:read"
  };

  it("should build URL without throwing", () => {
    expect(() => buildAuthorizeUrl(baseConfig, "test-state", "test-challenge")).not.toThrow();
  });

  it("should build URL with all required parameters", () => {
    const url = buildAuthorizeUrl(baseConfig, "test-state", "test-challenge");
    
    expect(url).toContain("response_type=code");
    expect(url).toContain("client_id=test-client-123");
    expect(url).toContain("redirect_uri=" + encodeURIComponent("http://localhost:8080/callback"));
    expect(url).toContain("state=test-state");
    expect(url).toContain("code_challenge=test-challenge");
    expect(url).toContain("code_challenge_method=S256");
  });

  it("should include scope parameter", () => {
    const url = buildAuthorizeUrl(baseConfig, "state", "challenge");
    
    expect(url).toContain("scope=" + encodeURIComponent("tasks:read"));
  });

  it("should use S256 code challenge method", () => {
    const url = buildAuthorizeUrl(baseConfig, "state", "challenge");
    
    expect(url).toMatch(/code_challenge_method=S256/);
  });

  it("should properly encode special characters in parameters", () => {
    const configWithSpecialChars = {
      ...baseConfig,
      clientId: "client+with=special&chars"
    };
    
    const url = buildAuthorizeUrl(configWithSpecialChars, "state&with=special", "challenge+with=special");
    
    expect(url).toContain("client_id=" + encodeURIComponent("client+with=special&chars"));
    expect(url).toContain("state=" + encodeURIComponent("state&with=special"));
    expect(url).toContain("code_challenge=" + encodeURIComponent("challenge+with=special"));
  });

  it("should build URL starting with authorize URL", () => {
    const url = buildAuthorizeUrl(baseConfig, "state", "challenge");
    
    expect(url).toContain("https://dida365.com/oauth/authorize");
  });
});

describe("Edge Cases and Boundary Conditions", () => {
  describe("OAuthConfig edge cases", () => {
    it("should handle very long clientId", () => {
      const longId = "a".repeat(500);
      const config: OAuthConfig = {
        clientId: longId,
        authorizeUrl: "https://example.com/authorize",
        tokenUrl: "https://example.com/token",
        redirectUri: "http://localhost/callback"
      };
      
      expect(config.clientId.length).toBe(500);
    });

    it("should handle special characters in scope", () => {
      const config: OAuthConfig = {
        clientId: "test",
        authorizeUrl: "https://example.com/authorize",
        tokenUrl: "https://example.com/token",
        redirectUri: "http://localhost/callback",
        scope: "tasks:read tasks:write profile offline_access"
      };
      
      expect(config.scope).toContain(" ");
    });

    it("should handle localhost redirect URI", () => {
      const config: OAuthConfig = {
        clientId: "test",
        authorizeUrl: "https://example.com/authorize",
        tokenUrl: "https://example.com/token",
        redirectUri: "http://127.0.0.1:3000/auth"
      };
      
      expect(config.redirectUri).toContain("127.0.0.1");
    });

    it("should handle custom port in redirect URI", () => {
      const config: OAuthConfig = {
        clientId: "test",
        authorizeUrl: "https://example.com/authorize",
        tokenUrl: "https://example.com/token",
        redirectUri: "http://localhost:8888/myapp/oauth/callback"
      };
      
      expect(config.redirectUri).toContain(":8888");
    });
  });
});
