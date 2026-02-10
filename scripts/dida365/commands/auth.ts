import type { Command } from "commander";
import { loadConfig } from "../core/config.js";
import { loginFlow, refreshAccessToken } from "../core/oauth.js";
import { resolveTokenPath, loadToken, saveToken, clearToken, withRefreshMutex } from "../core/token.js";

export function registerAuth(program: Command) {
  const auth = program.command("auth").description("OAuth commands");

  auth
    .command("login")
    .description("OAuth login (callback by default; manual/headless supported)")
    .option("--headless", "Manual mode: print URL and paste code")
    .option("--no-browser", "Do not open browser automatically")
    .option("--timeout-ms <ms>", "Callback timeout", (v) => Number(v), 120000)
    .action(async (opts, command) => {
      const root = command.parent;
      const globalOpts = root?.opts() ?? {};
      const { config } = await loadConfig(globalOpts.config);

      const oauth = config.oauth ?? {};
      const clientId = oauth.clientId;
      const authorizeUrl = oauth.authorizeUrl ?? "https://dida365.com/oauth/authorize";
      const tokenUrl = oauth.tokenUrl ?? "https://dida365.com/oauth/token";
      const redirectUri = oauth.redirectUri;
      if (!clientId || !redirectUri) {
        console.error("❌ Missing OAuth config. Please set oauth.clientId and oauth.redirectUri in your config file.");
        console.error("   Config file location: ~/.config/dida365.json");
        process.exit(1);
      }

      console.log("🔐 Starting OAuth login...");
      const token = await loginFlow(
        {
          clientId,
          clientSecret: oauth.clientSecret,
          authorizeUrl,
          tokenUrl,
          redirectUri,
          scope: oauth.scope,
          openBrowser: opts.browser !== false && oauth.openBrowser !== false,
          callbackTimeoutMs: oauth.callbackTimeoutMs
        },
        { headless: Boolean(opts.headless), timeoutMs: Number(opts.timeoutMs), listenHost: oauth.listenHost }
      );

      const tokenPath = resolveTokenPath(config);
      await saveToken(tokenPath, token);
      const friendlyPath = tokenPath.replace(process.env.HOME ?? "", "~");

      console.log("✅ Login successful!");
      console.log(`📁 Token saved: ${friendlyPath}`);
      console.log(`⏰ Expires: ${token.expires_at ? new Date(token.expires_at).toLocaleString("zh-CN") : "Never"}`);
    });

  auth
    .command("refresh")
    .description("Refresh access token using refresh_token")
    .action(async (_opts, command) => {
      const root = command.parent;
      const globalOpts = root?.opts() ?? {};
      const { config } = await loadConfig(globalOpts.config);

      const oauth = config.oauth ?? {};
      const clientId = oauth.clientId;
      const tokenUrl = oauth.tokenUrl ?? "https://dida365.com/oauth/token";
      if (!clientId) {
        console.error("❌ Missing OAuth config. Please set oauth.clientId in your config file.");
        process.exit(1);
      }

      const tokenPath = resolveTokenPath(config);
      const current = await loadToken(tokenPath);
      if (!current?.refresh_token) {
        console.error("❌ No refresh_token found. Please run 'dida365 auth login' first.");
        process.exit(1);
      }

      console.log("🔄 Refreshing token...");
      const updated = await withRefreshMutex(() =>
        refreshAccessToken(
          {
            clientId,
            clientSecret: oauth.clientSecret,
            authorizeUrl: oauth.authorizeUrl ?? "",
            tokenUrl,
            redirectUri: oauth.redirectUri ?? "",
            scope: oauth.scope,
            openBrowser: false
          },
          current.refresh_token!
        )
      );

      await saveToken(tokenPath, updated);
      console.log("✅ Token refreshed!");
      console.log(`⏰ New expires: ${updated.expires_at ? new Date(updated.expires_at).toLocaleString("zh-CN") : "Never"}`);
    });

  auth
    .command("logout")
    .description("Clear saved token")
    .option("--force", "Confirm logout")
    .action(async (opts, command) => {
      const root = command.parent;
      const globalOpts = root?.opts() ?? {};
      const { config } = await loadConfig(globalOpts.config);

      if (!opts.force) {
        console.error("❌ Refusing to logout without --force");
        console.error("   Use: dida365 auth logout --force");
        process.exit(1);
      }

      const tokenPath = resolveTokenPath(config);
      await clearToken(tokenPath);
      const friendlyPath = tokenPath.replace(process.env.HOME ?? "", "~");

      console.log("✅ Logged out!");
      console.log(`🗑️  Token removed: ${friendlyPath}`);
    });
}
