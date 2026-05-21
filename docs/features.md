# 功能文档

## 1. 功能总览

```
┌─────────────────────────────────────────────────────────────┐
│  Vibe Notch                                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────────────────────────┐  │
│  │ CollapsedBar │  │ ExpandedPanel                       │  │
│  │ (Pill 小条)  │  │ (完整面板)                          │  │
│  │              │  │  ┌──────┐  ┌──────┐  ┌──────┐      │  │
│  │ 🐙 运行中... │  │  │ TopBar│  │ 标签 │  │关闭 │      │  │
│  │        3会话 │  │  └──────┘  └──────┘  └──────┘      │  │
│  └──────────────┘  │  ┌───────────────────────────────┐  │  │
│                    │  │ AgentGroup - Claude            │  │  │
│                    │  │ ┌─────────┐ ┌─────────┐       │  │  │
│                    │  │ │Session  │ │Session  │ ...   │  │  │
│                    │  │ │  Card   │ │  Card   │       │  │  │
│                    │  │ └─────────┘ └─────────┘       │  │  │
│                    │  └───────────────────────────────┘  │  │
│                    │  ┌───────────────────────────────┐  │  │
│                    │  │ AgentGroup - Codex             │  │  │
│                    │  │ ...                            │  │  │
│                    │  └───────────────────────────────┘  │  │
│                    └─────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Tray (系统托盘)                                            │
│  - 显示/隐藏      │  - 开机启动    │  - 退出                │
└─────────────────────────────────────────────────────────────┘
```

## 2. 核心模块

### 2.1 CollapsedBar - 收起状态

**文件**: `src/components/CollapsedBar.vue`

**职责**: 提供最小化状态的状态概览，作为用户与应用交互的入口。

**关键实现**:
- Canvas 2D 绘制像素章鱼吉祥物（26x22 CSS 像素，devicePixelRatio 适配）
- `CanvasRenderer` 引擎驱动三种动画场景：idle / processing / waitingApproval
- 吉祥物状态由 Pinia store 全局管理（`notchStore.mascotStatus`），`CollapsedBar` 与 `TopBar` 共享同一状态
- **`mascotStatus` 为计算属性**，基于实际会话状态实时映射：全部 sleeping → `idle`，有 waitingApproval → `waitingApproval`，有 working/thinking/tool_use/responding → `processing`
- 状态文字 + 颜色 + 发光效果联动
- 动态省略号动画（450ms 周期：'' → '.' → '..' → '...'）
- 等宽字体营造科技像素风（Courier New / Consolas / Monaco）

**状态映射**:

| 状态 | 文字 | 颜色 | 动画场景 |
|------|------|------|----------|
| idle | 休息中 | #e5e7eb（白灰） | 睡觉呼吸 + Zzz |
| processing | 运行中 | #4ade80（绿） | 弹跳打字 |
| waitingApproval | 请确认 | #f87171（红） | 跳跃告警 |

### 2.2 展开面板组件群

展开面板相关组件的**详细接口定义、视觉规范、性能指标**见 [`expanded-panel.md`](expanded-panel.md)。

| 组件 | 文件 | 职责 |
|------|------|------|
| ExpandedPanel | `src/components/ExpandedPanel.vue` | 560×370px 容器，毛玻璃背景，分组列表 + 空状态 |
| TopBar | `src/components/TopBar.vue` | 标签过滤 (ALL/STA/CLI)、Canvas 吉祥物、关闭按钮 |
| AgentGroup | `src/components/AgentGroup.vue` | 按 agentType 分组（Claude→Codex→Gemini），空组隐藏 |
| SessionCard | `src/components/SessionCard.vue` | 像素章鱼图标 + 项目信息 + 终端输出 + 状态徽章 |
| TerminalOutput | `src/components/TerminalOutput.vue` | 按类型着色渲染（command/output/thinking/link/prompt）|
| SettingsPanel | `src/components/SettingsPanel.vue` | 设置模态框（当前版本暂不渲染）|

## 3. Canvas 渲染引擎

**目录**: `src/renderer/canvas/`

### 3.1 架构

```
canvas-renderer.ts  (CanvasRenderer 类)
    ├── renderSleepScene()   - idle 场景
    ├── renderWorkScene()    - processing/running 场景
    ├── renderAlertScene()   - waitingApproval/waitingQuestion 场景
    ├── renderFloatingZ()    - 浮动 Zzz
    ├── renderKeyboard()     - 键盘
    ├── renderTypingArms()   - 打字手臂
    └── renderWorkEyes()     - 工作场景眼睛

sprites.ts          (精灵定义)
    ├── CLAWD_COLORS       - 调色板
    ├── SCENE_VIEWPORTS    - 场景视口参数
    ├── createViewportMapper() - 坐标映射
    ├── mapRect()          - 矩形映射
    ├── armPath()          - 旋转手臂路径
    └── drawArmPolygon()   - 多边形绘制

animations.ts       (动画系统)
    ├── SPRING_PRESETS     - 弹簧预设
    ├── springValue()      - 弹簧物理模拟
    ├── lerpKeyframes()    - 关键帧插值
    ├── SpringAnimator     - rAF 驱动器
    └── 关键帧数据
```

### 3.2 动画场景详情

#### Sleep 场景（idle）
- **周期**: 4.5s 呼吸周期
- **效果**: 躯体随呼吸膨胀（scale 1~1.015）、阴影深浅变化、浮动 Zzz（3 个 z 交错上浮淡出）

#### Work 场景（processing/running）
- **弹跳**: 0.35s 周期正弦波
- **呼吸**: 3.2s 周期
- **手臂**: 左臂 -55°~-10°（0.15s），右臂 10°~55°（0.12s）
- **键盘**: 6x3 按键网格，按键高亮与手臂同步
- **眼睛**: 眯眼 0.5 + 扫视 1.0 + 眨眼 0.1

#### Alert 场景（waitingApproval/waitingQuestion）
- **周期**: 3.5s
- **跳跃**: 关键帧驱动（多段跳跃）
- **手臂**: 挥舞关键帧（-40°~155°）
- **压扁/拉伸**: 落地时 scaleX 1.05 / scaleY 0.96
- **光晕**: 0.5s 脉冲红色 radial gradient
- **感叹号**: 缩放 + 透明度关键帧

## 4. 音效系统

**实现**: `src/services/soundService.ts`

**设计目标**: 为会话状态变化提供 8-bit 风格的声音反馈，让用户在不看屏幕时也能感知 AI 工作状态变化。

**音效文件**（`public/resources/sounds/`）：

| 文件名 | 触发场景 | 冷却时间 |
|--------|---------|---------|
| `8bit_boot.wav` | 应用启动 | 只播放一次 |
| `8bit_start.wav` | 会话从 sleeping 变为 working/thinking/tool_use/responding | 2s |
| `8bit_complete.wav` | 会话从活跃状态变为 sleeping | 2s |
| `8bit_approval.wav` | 会话变为 waitingApproval | 3s |
| `8bit_error.wav` | 预留 | 1s |
| `8bit_submit.wav` | 预留 | 1s |

**状态转换触发规则**：

| 前状态 | 后状态 | 音效 |
|--------|--------|------|
| sleeping | working/thinking/tool_use/responding | `start` |
| any | waitingApproval | `approval` |
| working/thinking/tool_use/responding | sleeping | `complete` |
| waitingApproval | sleeping | `complete` |

**架构**: `SoundService` 为单例，在 `notchStore` 的 `updateSessions` 中通过对比 `previousSessions` 检测状态变化并调用。设置变更时通过 `soundService.setEnabled()` 同步开关状态。

## 5. 会话监控（Claude Code 日志读取）

**实现**: `electron/services/claudeLogMonitor.ts` + `electron/services/sessionManager.ts`

**数据来源**:
- 状态文件: `~/.claude/sessions/<pid>.json` —— 包含 `sessionId`, `cwd`, `status` (busy/idle), `updatedAt`
- 日志文件: `~/.claude/projects/<hash>/<sessionId>.jsonl` —— JSON Lines 格式，包含 user/assistant/thinking/tool_use 等事件

**扫描逻辑**:
1. 每 1.5 秒扫描 `sessions/` 目录，读取所有 `.json` 状态文件
2. 过滤出 `kind === 'interactive' && entrypoint === 'cli'` 的会话
3. 根据 `sessionId` 在 `projects/` 下查找对应的 `.jsonl` 日志文件
4. 读取 JSONL 末尾 50 行，解析事件类型判断状态和提取输出

**状态映射**（6 状态，基于最后事件类型）：

| 原始状态 | 最后事件类型 | 条件 | 映射为 |
|---------|-------------|------|--------|
| `idle` | — | — | `sleeping` |
| `waiting` | — | `waitingFor: "permission prompt"` | `waitingApproval` |
| `busy` | `user` | 用户刚输入 | `working` |
| `busy` | `tool_use` | 正在执行工具 | `tool_use` |
| `busy` | `assistant`/`message` | 包含 thinking 内容 | `thinking` |
| `busy` | `assistant`/`message` | 无 thinking 内容 | `responding` |
| `busy` | 其他/无事件 | fallback | `working` |

**嵌套 tool_use 支持**: Claude Code API 的 `tool_use` 事件嵌套在 `assistant`/`message` 类型的 `content` 数组中（`content[0].type === 'tool_use'`）。`findLastEventOfType` 同时检查顶层 `type` 和嵌套 content，确保正确识别工具调用。

**输出提取**（统一简洁策略）：
| 状态 | 提取内容 |
|------|---------|
| `thinking` | 返回空（TerminalOutput 展示 `thinking...`） |
| `tool_use` | 返回空（TerminalOutput 展示 `using tool...`） |
| `responding` | 返回空（TerminalOutput 展示 `responding...`） |
| `working` | 返回空（TerminalOutput 展示 `working...`） |
| `waitingApproval` | 返回空（TerminalOutput 展示 `waiting...`） |
| `sleeping` | 最后一行有意义输出 |

事件类型映射（sleeping 状态）：
- `user` → `prompt` 类型（用户输入）
- `assistant`/`message` → `output` 类型（AI 回复 text 块）
- `thinking` → `thinking` 类型（思考内容）
- `tool_use` → `command` 类型（工具调用）
- `tool_result` → `output` 类型（工具返回结果）

## 5. 数据模型

### 4.1 Session（会话）

```typescript
interface Session {
  id: string              // 唯一标识
  projectName: string      // 项目名称
  sessionNumber?: string   // 编号（如 #8387）
  pid?: number             // 进程 ID（用于终端窗口聚焦）
  agentType: 'claude' | 'codex' | 'gemini'
  terminalType: 'ghostty' | 'iterm2' | 'cmd' | 'powershell' | 'wt'
  status: 'thinking' | 'tool_use' | 'responding' | 'working' | 'waitingApproval' | 'sleeping'
  lastOutput: OutputLine[] // 最近终端输出
  timestamp: number        // 时间戳
  relativeTime: string     // 相对时间文本
}
```

### 4.2 OutputLine（终端输出行）

```typescript
interface OutputLine {
  type: 'command' | 'output' | 'thinking' | 'link' | 'prompt'
  content: string
  linkUrl?: string  // 仅 link 类型
}
```

### 4.3 Store 状态

```typescript
interface AppState {
  isExpanded: boolean
  activeTab: 'all' | 'sta' | 'cli'
  sessions: Session[]
  dockPosition: 'top' | 'bottom' | 'left' | 'right' | 'none'
  mascotStatus: 'idle' | 'processing' | 'waitingApproval'
}
```

## 6. IPC 通信

**通道列表**:

| 通道名 | 方向 | 说明 |
|--------|------|------|
| `window:toggle-expand` | R → M | 切换展开/收起 |
| `window:set-expanded` | R → M | 设置展开状态（boolean） |
| `window:dock` | R → M | 贴边到指定位置 |
| `window:show/hide` | R → M | 显示/隐藏窗口 |
| `window:expand-changed` | M → R | 通知展开状态变更 |
| `sessions:update` | M → R | 推送会话数据更新 |
| `settings:get/set` | R ↔ M | 获取/保存设置 |
| `settings:changed` | M → R | 设置变更通知 |
| `app:quit` | R → M | 退出应用 |
| `terminal:focus` | R → M | 通过 PID 聚焦对应终端窗口 |

**终端聚焦实现**:

**渲染进程事件链**：
- `SessionCard` 根元素监听 `@click`，`$emit('click', session)` 将事件向上传递
- `AgentGroup` 透传 `@click` → `$emit('session-click', $event)` 至 `ExpandedPanel`
- `ExpandedPanel.handleSessionClick(session)` 调用 `window.electronAPI.focusTerminal(session.pid)`
- `preload.ts` 暴露 `focusTerminal: (pid) => ipcRenderer.send('terminal:focus', pid)`

**主进程激活流程**（三层极速响应）：
1. **第一层——直接窗口匹配（~1-10ms）**：遍历所有顶层可见窗口（`GetDesktopWindow` → `GetWindow(GW_CHILD)` → `GetWindow(GW_HWNDNEXT)`），通过 `GetWindowThreadProcessId` 匹配目标 PID。找到后立即 `SetForegroundWindow` + `BringWindowToTop` 激活。
2. **第二层——控制台窗口（~5-20ms）**：若目标进程没有独立可见窗口（如 WT 标签页中的子进程），通过 `AttachConsole(pid)` 附加到其控制台 + `GetConsoleWindow()` 获取句柄并激活。
3. **第三层——父进程链兜底（~50-200ms）**：以上均失败时，异步执行轻量 `wmic process where "ProcessId=<pid>" get ParentProcessId,Name` 查询父进程链（最多 6 层），对遇到的每个祖先进程（直到 `WindowsTerminal.exe`、`cmd.exe`、`powershell.exe` 等）重复执行第一层和第二层窗口查找。

- **无缓存**：每次点击实时解析，无 TTL 缓存，无后台预热。
- **无延迟**：`ShowWindow(SW_RESTORE)` 后立即 `SetForegroundWindow`，没有 setTimeout 等待。
- **前台权限**：使用 `AttachThreadInput` 附加当前线程到前景窗口输入队列，绕过 Windows 前台权限限制，激活后立即分离。

## 7. 窗口系统

**文件**: `electron/windows/notchWindow.ts`

### 6.1 窗口属性
- 无边框（frame: false）
- 置顶（alwaysOnTop: 'screen-saver'）
- 全工作区可见（visibleOnAllWorkspaces: true）
- 跳过任务栏（skipTaskbar: true）
- 透明背景（transparent: true, backgroundColor: '#00000000'）
- Windows 类型：toolbar

### 6.2 尺寸状态

| 状态 | 宽度 | 高度 | 位置 |
|------|------|------|------|
| 收起 | 300px | 36px | 屏幕顶部居中 |
| 展开 | 560px | 370px（固定高度，内容滚动） | 从收起位置向中心展开 |

### 6.3 贴边吸附
- 吸附阈值：40px
- 支持四边：top / bottom / left / right
- 拖拽结束时自动检测并吸附

## 8. 样式系统

### 7.1 CSS 变量

```css
:root {
  --bg-panel: rgba(10, 10, 18, 0.98);
  --bg-primary: #080810;
  --bg-secondary: rgba(10, 10, 18, 0.98);
  --bg-card: rgba(255, 255, 255, 0.04);
  --bg-card-hover: rgba(255, 255, 255, 0.07);
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.5);
  --text-muted: rgba(255, 255, 255, 0.35);
  --accent-green: #4ade80;
  --accent-blue: #60a5fa;
  --accent-orange: #fb923c;
  --accent-purple: #8b5cf6;
  --border-color: rgba(255, 255, 255, 0.06);
  --radius-full: 9999px;
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.4);
  --backdrop-blur: blur(24px) saturate(1.2);
}
```

### 7.2 动画系统

所有动画统一在 `src/styles/animations.css` 中定义：
- 闪烁竖条（已由 Canvas 替代）
- Thinking 光标闪烁
- 展开/收起过渡
- 淡入/上滑入
- 缩放淡入
- 脉冲光晕
- 呼吸效果
- 弹跳/旋转
- 渐变背景流动
- Vue Transition 类（notch-expand / panel-fade / list-stagger / modal / settings）
