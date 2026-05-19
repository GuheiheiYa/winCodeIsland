# Claude Code 日志格式规范

本文档记录 Claude Code CLI 生成的本地日志文件格式，供 `ClaudeLogMonitor` 读取和解析。

## 文件位置

```
~/.claude/sessions/<pid>.json          # 会话状态文件
~/.claude/projects/<hash>/<sessionId>.jsonl   # 事件日志（JSON Lines）
```

`<hash>` 是对项目路径的编码（如 `D--project-aiProject-winCodeIsland`）。

---

## 1. 会话状态文件（sessions/<pid>.json）

每个交互式 CLI 会话对应一个状态文件。

```typescript
interface SessionState {
  pid: number              // 进程 ID
  sessionId: string        // UUID，如 "18136c70-6a78-419e-987c-d4e4151bc37f"
  cwd: string              // 当前工作目录
  startedAt: number        // 启动时间戳（ms）
  status: 'busy' | 'idle' | 'waiting'   // 核心状态
  updatedAt: number        // 最后更新时间戳（ms）
  waitingFor?: string      // 仅在 status === 'waiting' 时出现，如 "permission prompt"
  kind: 'interactive'
  entrypoint: 'cli'
  version: string          // Claude Code 版本，如 "2.1.144"
}
```

### 状态说明

| `status` | 含义 | Vibe Notch 映射 |
|---------|------|----------------|
| `idle` | 空闲，无进行中的请求 | `sleeping` |
| `busy` | 正在处理中 | 根据 jsonl 最后事件判断 |
| `waiting` | 等待用户确认 | `waitingApproval` |

---

## 2. 事件日志（.jsonl）

每行一个 JSON 对象，按时间顺序追加。常见事件类型：

### 2.1 `permission-mode`

会话初始化时发送一次。

```json
{"type":"permission-mode","permissionMode":"default","sessionId":"..."}
```

### 2.2 `user`

用户输入（包括 tool_result 的回传）。

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {"type": "text", "text": "重构一下项目"},
      // 或 tool_result：
      {"type": "tool_result", "tool_use_id": "...", "content": "文件内容..."}
    ]
  },
  "uuid": "...",
  "timestamp": "2026-05-19T14:28:52.030Z",
  "sessionId": "..."
}
```

**注意**：`tool_result` 的 `content` 可能是完整文件内容，体积很大（几十 KB）。

### 2.3 `assistant` / `message`

Claude 的回复。两者等价，`message` 是较新的字段名。

```json
{
  "type": "assistant",
  "message": {
    "id": "msg_xxx",
    "type": "message",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "让我先尝试编译..."},
      {"type": "thinking", "thinking": "从已读取的文件中..."},
      {"type": "tool_use", "id": "tool_xxx", "name": "Bash", "input": {"command": "npx tsc --noEmit"}}
    ],
    "stop_reason": "tool_use"
  },
  "timestamp": "2026-05-19T14:30:11.321Z",
  "sessionId": "..."
}
```

**关键字段**：
- `content` 是数组，按顺序包含 `text` / `thinking` / `tool_use` 块
- `stop_reason`: `"tool_use"` | `"end_turn"` | `null`
- `name`: 工具名（`Bash` / `Read` / `Edit` / `Write` / `GrepSearch` / `WebFetch` / `WebSearch`）
- `input`: 工具参数，结构因工具而异

### 2.4 `thinking`（独立事件）

早期版本的 thinking 可能作为独立事件发送：

```json
{
  "type": "thinking",
  "thinking": "让我分析一下...",
  "timestamp": "..."
}
```

### 2.5 `tool_use`（顶层事件）

少数情况下 `tool_use` 作为顶层事件出现（非嵌套）：

```json
{
  "type": "tool_use",
  "name": "Bash",
  "input": {"command": "ls -la"}
}
```

### 2.6 `tool_result`

工具执行结果（通常由用户事件回传，而非独立事件）。

```json
{
  "type": "tool_result",
  "tool_use_id": "tool_xxx",
  "content": "命令输出或文件内容"
}
```

### 2.7 `last-prompt`

记录最后发送给 Claude 的提示内容。

```json
{"type":"last-prompt","prompt":"...","sessionId":"..."}
```

### 2.8 `ai-title`

AI 自动生成的会话标题。

```json
{"type":"ai-title","title":"代码重构","sessionId":"..."}
```

### 2.9 `queue-operation`

内部队列操作标记。

```json
{"type":"queue-operation","sessionId":"..."}
```

### 2.10 `file-history-snapshot`

文件历史快照（用于撤销）。

```json
{
  "type": "file-history-snapshot",
  "messageId": "...",
  "snapshot": {"trackedFileBackups": {}, "timestamp": "..."}
}
```

---

## 3. 工具参数结构

### Bash

```json
{"name": "Bash", "input": {"command": "npx tsc --noEmit", "description": "运行类型检查"}}
```

### Read

```json
{"name": "Read", "input": {"file_path": "D:/project/claudeIsland/src/main.ts"}}
```

### Edit

```json
{"name": "Edit", "input": {"file_path": "...", "old_string": "...", "new_string": "..."}}
```

### Write

```json
{"name": "Write", "input": {"file_path": "...", "content": "..."}}
```

### GrepSearch

```json
{"name": "GrepSearch", "input": {"query": "pattern", "paths": ["src/"]}}
```

---

## 4. Vibe Notch 解析策略

### 状态判断流程

1. 读取 `sessions/<pid>.json`
2. 过滤 `kind === 'interactive' && entrypoint === 'cli'`
3. 查找对应 `sessionId` 的 `.jsonl` 文件
4. 读取 jsonl 最后 50 行
5. 状态映射：
   - `state.status === 'idle'` → `sleeping`
   - `state.status === 'waiting'` → `waitingApproval`
   - `state.status === 'busy'` → 根据最后事件类型判断

### 嵌套 tool_use 处理

Claude Code API 的 `tool_use` **嵌套在 `assistant`/`message` 的 `content` 数组中**，不是顶层 `type`。

`findLastEventOfType` 必须同时检查：
1. 顶层 `type === 'tool_use'`
2. `type === 'assistant'` 且 `message.content[].type === 'tool_use'`

### 输出提取（当前策略）

| 状态 | 行为 |
|------|------|
| `thinking` | 返回空 → TerminalOutput 展示 `thinking...` |
| `tool_use` | 返回空 → TerminalOutput 展示 `using tool...` |
| `responding` | 返回空 → TerminalOutput 展示 `responding...` |
| `working` | 返回空 → TerminalOutput 展示 `working...` |
| `waitingApproval` | 返回空 → TerminalOutput 展示 `waiting...` |
| `sleeping` | 遍历 jsonl 找最后一行有意义的输出 |
