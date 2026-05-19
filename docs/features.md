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

### 2.2 ExpandedPanel - 展开面板

**文件**: `src/components/ExpandedPanel.vue`

**职责**: 点击 Pill 小条后展开，展示完整的会话列表和详情。

**关键实现**:
- 尺寸 560px 宽，固定高度 **370px**（内容在面板内部滚动），带自定义滚动条
- 底部圆角 24px，无边框顶部，micro-curve 弧线过渡
- 按助手分组（Claude / Codex / Gemini）交错淡入动画
- 空状态友好提示

### 2.3 TopBar - 顶部栏

**文件**: `src/components/TopBar.vue`

**职责**: 展开面板的顶部控制区。

**功能**:
- 左侧 Canvas 像素章鱼吉祥物（28x24 CSS 像素，与 CollapsedBar 共享状态）
- ALL / STA / CLI 标签切换（过滤会话状态）
- 音量按钮（预留声音提示接口）
- 关闭按钮（红色电源图标，收起面板）

> 设置功能当前版本已移除（设置面板组件保留但不再渲染）。

### 2.4 SessionCard - 会话卡片

**文件**: `src/components/SessionCard.vue`

**职责**: 单个会话的信息展示单元。

**展示内容**:
- 像素风项目图标（城堡/骷髅/星星等）
- 项目名称 + 会话编号
- 时间标签（1h、<1m、1m）
- 终端类型（Ghostty/iTerm2 + 彩色圆点）
- 最近终端输出（sleeping 状态展示最后一行历史输出；活跃状态统一展示状态提示文字）
- 状态指示：sleeping（zzz图标）、thinking（光标闪烁+绿色）、tool_use（绿色圆点）、responding（蓝色圆点）、working（绿色圆点）、waitingApproval（橙色感叹号）

### 2.4.1 TerminalOutput - 终端输出渲染

**文件**: `src/components/TerminalOutput.vue`

**职责**: 渲染会话的最近终端输出。活跃状态统一展示简洁的状态提示，sleeping 状态展示最后一行历史输出。

**渲染策略**:

| 行类型 | 渲染方式 | 说明 |
|--------|---------|------|
| `command` | 纯文本 | `$ ` 前缀，灰色 |
| `prompt` | 纯文本 | `$ ` 前缀，白色 |
| `output` | 纯文本 | 绿色前缀 `> ` |
| `thinking` | 纯文本 + 光标 | 灰色文字 + 闪烁光标 |
| `link` | 链接 | 蓝色可点击链接 |

**活跃状态展示**: 所有活跃状态（thinking / tool_use / responding / working / waitingApproval）统一返回空数组，由 TerminalOutput 展示对应的状态提示文字（`thinking...` / `using tool...` / `responding...` / `working...` / `waiting...`），带绿色脉冲动画。

**sleeping 状态展示**: 展示 JSONL 日志中最后一行有意义的输出（user prompt / assistant text / tool_result 等）。

**尺寸**: `max-height: 24px`，`overflow: hidden`，活跃状态严格只展示 1 行。

### 2.5 AgentGroup - 助手分组

**文件**: `src/components/AgentGroup.vue`

**职责**: 按 AI 助手类型聚合会话卡片。

**分组规则**:
- Claude（橙色太阳图标）
- Codex（紫色图标）
- Gemini（紫色钻石图标）
- 按固定顺序渲染，空组自动隐藏

### 2.6 SettingsPanel - 设置面板（暂不启用）

**文件**: `src/components/SettingsPanel.vue`

**职责**: 模态框形式的应用设置（组件保留但当前版本不再渲染）。

**配置项**（预留）：
| 配置项 | 类型 | 默认值 |
|--------|------|--------|
| 开机自启 | boolean | false |
| 贴边吸附 | boolean | true |
| 主题 | 'dark' \| 'light' \| 'auto' | 'dark' |
| 快捷键 | string | 'Ctrl+Shift+V' |
| 透明度 | number | 0.95 |

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

## 4. 会话监控（Claude Code 日志读取）

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
  agentType: 'claude' | 'codex' | 'gemini'
  terminalType: 'ghostty' | 'iterm2'
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
