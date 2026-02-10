/**
 * Integration tests for dida365-cli
 * 
 * IMPORTANT: These tests call the REAL Dida365 API.
 * They require:
 * 1. Valid token at ~/.config/dida365-cli/token.json
 * 2. Network access to api.dida365.com
 * 
 * Run with: npx vitest run test/integration/api.test.ts
 */

import { describe, it, expect } from "vitest";
import { Dida365Client } from "../../scripts/dida365/core/api.js";
import { loadToken } from "../../scripts/dida365/core/token.js";
import { Cache } from "../../scripts/dida365/core/cache.js";

// Only run integration tests if token exists
const hasToken = (): boolean => {
  try {
    const fs = require("fs");
    const tokenPath = require("path").join(require("os").homedir(), ".config/dida365-cli", "token.json");
    return fs.existsSync(tokenPath);
  } catch {
    return false;
  }
};

// Integration tests for API response formats
describe("Integration: API Response Formats", () => {
  
  it("projectsList returns array, NOT { projects: [...] }", async () => {
    if (!hasToken()) {
      console.log("⏭️  Skipping integration test: no token found");
      return;
    }
    
    const token = await loadToken("");
    if (!token?.access_token) {
      console.log("⏭️  Skipping: no access token");
      return;
    }
    
    const client = new Dida365Client({ 
      token: token.access_token,
      baseUrl: "https://api.dida365.com/open/v1" 
    });
    
    const result = await client.projectsList();
    
    // CRITICAL: Verify actual API response format
    // Real API returns: [...] (array)
    // Bug code expected: { projects: [...] } (object)
    expect(Array.isArray(result)).toBe(true);
    
    // Log for debugging
    console.log("✅ projectsList returns array:", result.length, "projects");
    console.log("   First project:", JSON.stringify(result[0]));
  });

  it("tasksGetAll returns { tasks: [...] }, NOT array", async () => {
    if (!hasToken()) {
      console.log("⏭️  Skipping integration test: no token found");
      return;
    }
    
    const token = await loadToken("");
    if (!token?.access_token) return;
    
    const client = new Dida365Client({ 
      token: token.access_token,
      baseUrl: "https://api.dida365.com/open/v1" 
    });
    
    // Get a project first
    const projects = await client.projectsList();
    if (projects.length === 0) {
      console.log("⏭️  Skipping: no projects found");
      return;
    }
    
    const projectId = projects[0].id;
    const result = await client.tasksGetAll(projectId);
    
    // Real API returns: { project: {...}, tasks: [...] }
    // This should be an object, NOT an array
    expect(typeof result).toBe("object");
    expect(Array.isArray(result)).toBe(false);
    expect(result).toHaveProperty("tasks");
    expect(Array.isArray((result as any).tasks)).toBe(true);
    
    console.log("✅ tasksGetAll returns object:", (result as any).tasks.length, "tasks");
  });

  it("get-all command works end-to-end", async () => {
    if (!hasToken()) {
      console.log("⏭️  Skipping integration test: no token found");
      return;
    }
    
    const token = await loadToken("");
    if (!token?.access_token) return;
    
    const client = new Dida365Client({ 
      token: token.access_token,
      baseUrl: "https://api.dida365.com/open/v1" 
    });
    
    // Simulate get-all command (all projects)
    const projects = await client.projectsList();
    console.log("   Found", projects.length, "projects");
    
    let totalTasks = 0;
    for (const p of projects) {
      const result = await client.tasksGetAll(p.id);
      const tasks = (result as any).tasks || [];
      totalTasks += tasks.length;
      console.log(`   - ${p.name}: ${tasks.length} tasks`);
    }
    
    console.log("✅ Total tasks across all projects:", totalTasks);
    expect(typeof totalTasks).toBe("number");
  });
});

