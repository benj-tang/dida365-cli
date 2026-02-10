import type { Command } from "commander";
import { loadConfig } from "../core/config.js";
import { resolveTokenPath, loadToken, isTokenExpired } from "../core/token.js";
import { defaultTokenPath } from "../core/token.js";

export function registerStatus(program: Command) {
  program
    .command("status")
    .description("Show authentication and configuration status")
    .action(async (opts, cmd) => {
      const root = cmd.parent;
      const globalOpts = root?.opts() ?? {};
      const { config } = await loadConfig(globalOpts.config);

      const tokenPath = resolveTokenPath(config);
      const token = await loadToken(tokenPath);

      // Check if using default path
      const usingDefaultPath = tokenPath === defaultTokenPath();
      const friendlyPath = usingDefaultPath 
        ? "~/.config/dida365-cli/token.json"
        : tokenPath.replace(process.env.HOME ?? "", "~");

      if (!token) {
        console.log("🔓 Authentication: Not logged in");
        console.log(`📁 Token path: ${friendlyPath}`);
        console.log(`\nRun 'dida365 auth login' to authenticate.`);
        return;
      }

      const isExpired = isTokenExpired(token);
      const expiresAt = token.expires_at 
        ? new Date(token.expires_at).toLocaleString("zh-CN")
        : "Never";

      console.log("🔐 Authentication: ✅ Logged in");
      console.log(`📁 Token path: ${friendlyPath}`);
      console.log(`⏰ Expires: ${expiresAt} ${isExpired ? "(⚠️ Expired)" : ""}`);
      console.log(`🌐 API: ${config.baseUrl ?? "https://api.dida365.com/open/v1"}`);
      console.log(`🕐 Timezone: ${config.timezone ?? "Asia/Shanghai"}`);
      
      if (config.requiredTags?.length) {
        console.log(`🏷️  Tags: ${config.requiredTags.join(", ")}`);
      }
    });
}
