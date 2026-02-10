# Dida365 CLI

Dida365 (滴答清单/TickTick) 的命令行工具，支持项目管理、任务管理、本地搜索等功能。

## 全局安装 / 本地 link / 运行方式

### 方法一：全局安装 (推荐)

```bash
# 全局安装
npm install -g dida365-cli

# 验证安装
dida365 --help

# 授权登录
dida365 auth login
```

### 方法二：本地 link

```bash
cd dida365-cli
npm install
npm link

# 验证
dida365 --help
```

### 方法三：直接运行编译后的产物

```bash
npm run build
./dist/scripts/dida365/cli.js --help
```

> **注意**：安装后无需使用 `npm run dev`，直接使用 `dida365` 命令即可。

## 环境依赖

- **Node.js**: >= 18.0.0
- **npm** 或 **bun**: 用于运行和构建

## 安装

```bash
cd dida365-cli-skill
npm install
```

## 配置

### 1. 获取 Dida365 开发者凭证

1. 访问 [Dida365 开发者平台](https://developer.dida365.com/)
2. 创建应用，获取 **Client ID** 和 **Client Secret**
3. 设置授权回调地址为: `http://localhost:38000/callback`
4. 申请权限: `tasks:read`, `tasks:write`

### 2. 配置 CLI

创建配置文件 `~/.config/dida365.json`:

```json
{
  "oauth": {
    "clientId": "你的_CLIENT_ID",
    "clientSecret": "你的_CLIENT_SECRET",
    "redirectUri": "http://localhost:38000/callback",
    "scope": "tasks:read tasks:write",
    "listenHost": "127.0.0.1",
    "openBrowser": true
  },
  "timezone": "Asia/Shanghai"
}
```

**必须配置项**:
- `oauth.clientId`: Dida365 应用的 Client ID
- `oauth.clientSecret`: Dida365 应用的 Client Secret
- `oauth.redirectUri`: 必须与开发者平台设置的一致

**可选配置项**:

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `oauth.listenHost` | （默认使用 `redirectUri` 的 host） | 本地 OAuth 回调服务器绑定地址 |
| `oauth.openBrowser` | `true` | 自动打开浏览器进行授权 |
| `oauth.callbackTimeoutMs` | `120000` | OAuth 回调等待超时（毫秒） |
| `oauth.tokenPath` | `~/.config/dida365-cli/token.json` | OAuth token 保存路径（可改） |
| `timezone` | 未设置（建议显式配置） | 日期时间解析时区（IANA 时区，例如 `Asia/Shanghai`） |
| `cacheDir` | `~/.cache/dida365-cli` | 缓存目录 |
| `cacheTtlSeconds` | `3600` | 缓存 TTL（秒） |
| `cacheStaleIfErrorSeconds` | `86400` | 出错时允许使用“过期缓存”的时间窗口（秒） |
| `timeoutMs` | `15000` | API 请求超时（毫秒） |
| `retries` | `3` | API 请求重试次数 |
| `requiredTags` | `['cli']`（启用时） | 创建/更新任务时强制追加的 tags（会标准化、去重） |
| `enableRequiredTags` | `true` | 是否启用 requiredTags 强制追加 |

> 说明：代码里还定义了 `projectsCacheTtlSeconds` / `tasksCacheTtlSeconds`（项目/任务分开 TTL），但当前实现以通用 cache 配置为主；如后续启用分开 TTL，需要再补充说明。

配置命令:
```bash
# 设置时区
dida365 config set timezone Asia/Shanghai

# 设置缓存 TTL（1小时）
dida365 config set cacheTtlSeconds 3600

# 设置缓存目录
dida365 config set cacheDir ~/.cache/dida365-cli

# 设置请求超时
dida365 config set timeoutMs 30000

# 设置 requiredTags（JSON 数组）
dida365 config set requiredTags '["cli","openclaw"]'

# 关闭 requiredTags 自动追加
dida365 config set enableRequiredTags false
```

### Tag 相关行为

任务创建/更新时 tags 的合并逻辑：

- 你传的 `--tag` / `--tag-hint` 作为“提示标签”
- 如果启用了 `enableRequiredTags`（默认启用），会自动把 `requiredTags`（默认 `['cli']`）加进去
- 最终会做标准化与去重：去空格、转小写、去重

你也可以在命令里覆盖：
- `--disable-required-tags`：本次命令禁用 requiredTags
- `--enable-required-tags`：本次命令强制启用 requiredTags

## 使用

> **提示**：全局安装或 `npm link` 后，直接使用 `dida365` 命令即可，无需 `npm run dev`。

### 快速开始

```bash
# 查看帮助
dida365 --help

# 授权登录
dida365 auth login

# 查看授权状态
dida365 auth status
```

### 生产构建 (如需要手动构建)

```bash
npm run build
dida365 --help
```

## 功能命令

### Projects 项目

```bash
# 列出所有项目（带7天缓存）
dida365 projects list --json

# 强制刷新缓存
dida365 projects list --force-refresh --json

# 创建项目
dida365 projects create --name "项目名称" --color "#FF6B6B" --view-mode list --kind TASK --json

# 更新项目
dida365 projects update --project-id <id> --name "新名称" --json

# 删除项目（危险操作）
dida365 projects delete --project-id <id> --force --json
```

### Tasks 任务

```bash
# 创建任务（全参数示例）
dida365 tasks create \
  --project-id <项目ID> \
  --title "任务标题" \
  --content "任务内容详情" \
  --desc "任务描述" \
  --start "2026-02-10 09:00" \
  --due "2026-02-10 18:00" \
  --reminder "TRIGGER:-PT30M" \
  --reminder "TRIGGER:-PT10M" \
  --repeat-flag "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR" \
  --priority 3 \
  --sort-order 1000 \
  --tag "标签1" \
  --tag "标签2" \
  --json

# 获取任务详情
dida365 tasks get --project-id <id> --task-id <id> --json

# 更新任务
dida365 tasks update --project-id <id> --task-id <id> --title "新标题" --json

# 完成任务
dida365 tasks complete --project-id <id> --task-id <id> --json

# 删除任务
dida365 tasks delete --project-id <id> --task-id <id> --force --json

# 获取项目下所有任务
dida365 tasks get-all --project-id <id> --json

# 搜索任务（本地实现，基于缓存）
dida365 tasks search --query "关键词" --json
dida365 tasks search --query "关键词" --project-ids "id1,id2" --json
dida365 tasks search --query "关键词" --status 0 --force-refresh --json
```

### 日期时间格式

- 格式: `YYYY-MM-DD HH:mm`
- 时区: 按配置 `timezone` 解释，默认系统时区
- 示例: `2026-02-10 09:00`

### 提醒格式

- 格式: `TRIGGER:-PT{分钟}M`
- 示例:
  - `TRIGGER:-PT30M` (提前30分钟)
  - `TRIGGER:-PT60M` (提前1小时)
  - `TRIGGER:PT0S` (准时)

### 重复规则 (RRULE)

- 每日: `RRULE:FREQ=DAILY;INTERVAL=1`
- 每周一三五: `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR`
- 每月: `RRULE:FREQ=MONTHLY;INTERVAL=1`

## 缓存机制

### 缓存策略

| 数据类型 | 默认缓存时间 | 失效触发 |
|---------|-------------|---------|
| 项目列表 | 7天 | 项目增删改 |
| 任务列表 | 10分钟 | 任务增删改完成 |

### 写时失效

所有写操作（create/update/delete/complete）都会自动清除相关缓存，下次读取时自动重新获取最新数据。

### 强制刷新

使用 `--force-refresh` 参数绕过缓存:
```bash
dida365 projects list --force-refresh
dida365 tasks search --query "xxx" --force-refresh
```

## 输出格式

所有命令支持 `--json` 输出标准 JSON:

```json
{
  "ok": true,
  "data": { ... },
  "warnings": [],
  "meta": { "cache": { "source": "origin" } }
}
```

错误时:
```json
{
  "ok": false,
  "error": { "type": "ValidationError", "code": "...", "message": "..." }
}
```

## License

MIT
