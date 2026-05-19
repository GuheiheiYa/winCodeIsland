# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 提供本仓库的代码指导。

## 项目概述

**Vibe Notch** 是一个受 macOS Dynamic Island（灵动岛）启发的 Windows 桌面应用。开发者在同时使用多个 AI 助手（Claude Code、OpenAI Codex、Google Gemini 等）进行终端开发时，通过悬浮在屏幕边缘的 Pill 形小条实时监控各会话状态——点击后展开为完整面板展示所有会话详情。

**技术栈**：Electron 28 + Vue 3（Composition API / `<script setup>`）+ TypeScript 5 + Pinia + Vite + electron-vite。

## 常用命令

```bash
# 开发模式（启动 Electron + Vite 开发服务器）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview

# 类型检查（不输出文件）
npm run typecheck

# 本项目未配置测试运行器和代码检查工具。
```

## 高层架构

### 进程边界

应用 cleanly 地拆分在 Electron 的进程边界两侧：

- **`electron/`** —— 主进程。负责原生窗口（`NotchWindowManager`）、系统托盘（`TrayManager`）和 IPC 处理器（`ipcHandlers.ts`）。主进程是窗口边界、贴边位置、会话数据的唯一真相源（通过读取 Claude Code 本地日志文件 `~/.claude/sessions/*.json` 和 `~/.claude/projects/<hash>/<sessionId>.jsonl` 获取真实会话状态）。
- **`src/`** —— 渲染进程。纯 Vue 前端。通过 `window.electronAPI`（由 `preload.ts` 暴露）读写状态。绝不直接使用 Node API。

**数据流**：`ClaudeLogMonitor`（`electron/services/claudeLogMonitor.ts`）定时扫描 Claude Code 本地日志 → `SessionManager`（`electron/services/sessionManager.ts`）聚合为 `Session[]` → 通过 IPC `sessions:update` 推送到渲染进程 → Pinia store（`notchStore.ts`）→ Vue 组件响应式重渲染。渲染进程可以通过 IPC 通道向主进程请求窗口变更（展开、贴边等）。

### 两种 UI 模式

整个 UI 要么是**收起**状态，要么是**展开**状态，由 `App.vue` 的条件渲染管理：

1. **CollapsedBar**（`src/components/CollapsedBar.vue`）—— 300x36px 的 Pill 小条。
   - 左侧：由 `CanvasRenderer`（`src/renderer/canvas/canvas-renderer.ts`）驱动的 Canvas 2D 像素章鱼吉祥物。
   - 吉祥物有三种场景：`idle`（睡觉 + Zzz）、`processing`（弹跳 + 打字）、`waitingApproval`（跳跃 + 告警感叹号）。
   - 状态文字、颜色、发光效果由同一吉祥物状态派生。
   - `mascotStatus` 是计算属性，基于实际会话状态实时映射：全部 sleeping → `idle`，有 waitingApproval → `waitingApproval`，其他活跃 → `processing`。

2. **ExpandedPanel**（`src/components/ExpandedPanel.vue`）—— 从收起小条展开的 560px 宽面板。
   - 使用 `AgentGroup` 和 `SessionCard` 按 `agentType` 分组显示会话（当前仅 Claude）。
   - TopBar 提供 ALL/STA/CLI 标签，按会话状态过滤。

### Canvas 渲染引擎

位于 `src/renderer/canvas/`。这是一个自定义的 2D 精灵引擎，不是通用 canvas 库：

- **`canvas-renderer.ts`** —— `CanvasRenderer` 类持有 canvas，运行 rAF 循环，根据 `getStatus()` 回调路由到三种场景渲染器之一。
- **`sprites.ts`** —— 在 SVG 单位空间中定义章鱼几何体，通过视口映射（`createViewportMapper`）确保同一场景在任何 canvas 尺寸下正确渲染。同时包含手臂旋转数学（`armPath`）。
- **`animations.ts`** —— 告警场景使用的弹簧物理（`springValue`）和关键帧插值（`lerpKeyframes`）。还包括 `SpringAnimator` 用于一次性弹簧动画（当前 UI 中未使用）。

**关键细节**：渲染器的 `startLoop(getStatus)` 接受一个每帧调用的回调。CollapsedBar 通过这种方式将吉祥物状态接入 canvas——返回的状态改变后，下一帧立即切换渲染场景。

### 状态管理

`useNotchStore`（Pinia，`src/stores/notchStore.ts`）是渲染进程中的唯一真相源：

- `sessions` —— `Session` 对象数组，通过 IPC 从主进程更新。
- `isExpanded` / `activeTab` / `dockPosition` —— UI 状态。
- `groupedByAgent` —— 计算属性，按 `agentType` 以固定顺序（Claude → Codex → Gemini）分组会话，过滤空组。
- `filteredSessions` —— 响应 `activeTab`：ALL = 全部，STA = sleeping/thinking，CLI = tool_use/responding/working。

### 会话数据模型

```typescript
type SessionStatus = 'thinking' | 'tool_use' | 'responding' | 'working' | 'waitingApproval' | 'sleeping'
type AgentType = 'claude' | 'codex' | 'gemini'
type TerminalType = 'ghostty' | 'iterm2'

interface Session {
  id: string
  projectName: string
  sessionNumber?: string
  agentType: AgentType
  terminalType: TerminalType
  status: SessionStatus
  lastOutput: OutputLine[]
  timestamp: number
  relativeTime: string
}
```

`OutputLine` 支持 `command | output | thinking | link | prompt` 类型，可选 `linkUrl`。

### 窗口与输入

`NotchWindowManager`（`electron/windows/notchWindow.ts`）负责：
- 无边框、置顶、透明、跳过任务栏的窗口创建。
- 通过渲染进程的 IPC 消息实现拖拽移动（`drag-start`、`drag-move`、`drag-end`）。
- 拖拽结束时贴边吸附（40px 阈值）。
- 收起（300x36）与展开（560x370，固定高度内容滚动）状态间的边界动画。

### IPC 事件（摘要）

| 方向 | 关键通道 |
|------|---------|
| 渲染进程 → 主进程 | `window:toggle-expand`、`window:set-expanded`、`window:dock`、`settings:set`、`app:quit` |
| 主进程 → 渲染进程 | `window:expand-changed`、`sessions:update`、`settings:changed` |

预加载脚本（`electron/preload.ts`）暴露类型化的 `window.electronAPI`，渲染进程代码使用它而非原始 `ipcRenderer`。

---

## 项目规范

### 代码风格

- **Vue 3 Composition API**：所有组件使用 `<script setup lang="ts">` 语法。
- **TypeScript 严格模式**：开启严格类型检查，禁止隐式 any。
- **组件职责单一**：业务逻辑通过 Pinia store 集中管理，组件只负责渲染和事件转发。
- **Canvas 渲染引擎与业务解耦**：`src/renderer/canvas/` 目录下的代码不依赖 Vue 或业务逻辑，只接收状态回调。
- **【强制】章鱼吉祥物视觉一致性**：任何使用 Claude 章鱼吉祥物的图标/插画（包括 SessionCard 项目图标、未来可能的其他地方），必须与 `CollapsedBar` 中的 `CanvasRenderer` 绘制保持完全一致：
  - **颜色**：身体 `#DE886D`、眼睛 `#000000`、键盘底座 `#617080`、键盘按键 `#99A9B8`、告警 `#FF3D00`
  - **造型**：参照 `canvas-renderer.ts` 中三种场景（sleep/work/alert）的精确几何比例绘制
  - **动画**：如有动画，周期和缓动函数必须与 Canvas rAF 循环一致（sleep 呼吸 4.5s、work 弹跳 0.35s、alert 周期 3.5s）
  - **数据源**：颜色常量必须从 `src/renderer/canvas/sprites.ts` 的 `CLAWD_COLORS` 导入，禁止硬编码其他色值

### 文件组织

```
electron/          # 主进程代码
  main.ts          # 入口
  windows/         # 窗口管理
  tray/            # 托盘管理
  ipc/             # IPC 处理器
  services/        # 服务层
    claudeLogMonitor.ts  # Claude Code 日志监控
    sessionManager.ts    # 会话管理器（聚合日志数据并推送）
  preload.ts       # 预加载脚本

src/               # 渲染进程代码
  components/      # Vue 组件
  stores/          # Pinia stores
  renderer/canvas/ # Canvas 2D 引擎
  services/        # 服务层（模拟数据等）
  styles/          # 全局样式、动画
  types/           # TypeScript 类型定义
  App.vue          # 根组件
  main.ts          # 渲染进程入口

public/            # 静态资源
  resources/cli-icons/  # AI 助手图标

docs/              # 项目文档（必须维护）
  requirements.md  # 需求文档
  features.md      # 功能文档
  changelog.md     # 更新日志
  expanded-panel-roadmap.md  # 展开面板功能拆解
```

### 命名约定

- 组件文件：PascalCase（如 `CollapsedBar.vue`）
- 工具/服务文件：camelCase（如 `canvas-renderer.ts`）
- Store：use + PascalCase（如 `useNotchStore`）
- 类型/接口：PascalCase（如 `SessionStatus`）
- CSS 变量：kebab-case（如 `--bg-primary`）

---

## 文档更新规范（强制执行）

**任何涉及功能变更的代码修改，必须同步更新 `docs/` 目录下的对应文档。**

### 更新规则

| 修改类型 | 必须更新的文档 | 更新内容 |
|---------|--------------|---------|
| 新增功能 | `features.md` + `requirements.md` | 模块说明、接口定义、状态映射 |
| 修改现有功能 | `features.md` | 对应模块的关键实现细节 |
| 修复 Bug | `changelog.md` | 在对应版本下添加修复记录 |
| 新增/修改组件 | `features.md` | 组件职责、Props/Emits、关键实现 |
| 数据模型变更 | `features.md` + `requirements.md` | 接口定义、类型更新 |
| 版本发布 | `changelog.md` | 版本号、日期、新增/修复/变更清单 |
| 架构调整 | `CLAUDE.md` | 高层架构、数据流、项目规范 |

### 检查清单

在提交功能变更前，确认以下文档已同步更新：

- [ ] `docs/features.md` —— 功能模块描述与实际代码一致
- [ ] `docs/requirements.md` —— 需求条目覆盖当前实现
- [ ] `docs/changelog.md` —— 变更已记录在对应版本下
- [ ] `CLAUDE.md` —— 架构描述未过时（如新增模块、数据流变更）

### 当前文档状态

| 文档 | 最后更新 | 说明 |
|------|---------|------|
| `requirements.md` | v1.0.4 | FR-1 ~ FR-7 需求定义，含 6 状态 + 370px 展开高度 |
| `features.md` | v1.0.4 | 6 状态会话监控、统一状态提示展示、嵌套 tool_use 修复 |
| `changelog.md` | v1.0.4 | 2026-05-19 发布，v1.0.4 统一状态展示 + mascotStatus 计算属性 |
| `claude-session-format.md` | v1.0.4 | Claude Code 日志格式规范（sessions.json + jsonl 事件类型） |
| `expanded-panel-roadmap.md` | v1.0.0 | 展开面板功能拆解、待开发项、版本规划 |
