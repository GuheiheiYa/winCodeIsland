# Vibe Notch

> Claude Code Terminal Session Monitor - Dynamic Island for Windows

一个受 macOS 灵动岛启发的 Windows 桌面应用，用于监控 Claude Code、Codex、Gemini 等 AI 助手在终端中的活动状态。

## 特性

- **灵动岛式 UI**：悬浮在屏幕边缘的 Pill 形状小条，显示实时工作状态
- **像素风章鱼吉祥物**：Canvas 2D 绘制的像素章鱼，根据状态播放三种动画（睡觉/打字/告警）
- **展开面板**：点击后展开为完整面板，按 AI 助手分组显示所有会话
- **毛玻璃效果**：使用 CSS `backdrop-filter` 实现现代感的半透明模糊效果
- **贴边吸附**：自动吸附到屏幕边缘（上/下/左/右）
- **系统托盘**：右键菜单支持显示/隐藏、开机启动、退出
- **真实 Claude 会话监控**：读取 `~/.claude/sessions/*.json` 和 `~/.claude/projects/<hash>/*.jsonl` 获取实时状态
- **CSS 动画**：所有动画使用 CSS keyframes，流畅且高性能

## 技术栈

- **Electron 28+** - 桌面应用框架
- **Vue 3** - 前端框架（Composition API + `<script setup>`）
- **TypeScript 5+** - 类型安全
- **Pinia** - 状态管理
- **Vite 5+** - 构建工具
- **electron-vite** - Electron + Vite 集成

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 项目结构

```
winCodeIsland/
├── electron/                     # 主进程（Main Process）
│   ├── main.ts                   # 入口：创建窗口、托盘、启动会话监控
│   ├── preload.ts                # 安全桥接：暴露 window.electronAPI 给渲染进程
│   │
│   ├── windows/
│   │   └── notchWindow.ts        # NotchWindowManager：无边框/置顶/透明窗口，管理收起(300x36)与展开(560x370)
│   ├── tray/
│   │   └── trayManager.ts        # 系统托盘图标 + 右键菜单（显示/隐藏/开机启动/退出）
│   ├── ipc/
│   │   └── ipcHandlers.ts        # IPC 处理器：窗口控制、设置读写、鼠标穿透
│   └── services/
│       ├── sessionManager.ts     # 会话管理器：每1.5秒扫描日志，推送 Session[] 到渲染进程
│       └── claudeLogMonitor.ts   # Claude Code 日志监控：读取 ~/.claude 下的 sessions/*.json 和 projects/*.jsonl
│
├── src/                          # 渲染进程（Renderer Process）
│   ├── main.ts                   # Vue 入口：createApp + Pinia + 挂载
│   ├── App.vue                   # 根组件：条件渲染 CollapsedBar / ExpandedPanel
│   │
│   ├── components/               # Vue 组件
│   │   ├── CollapsedBar.vue      # 收起 Pill 小条：Canvas 章鱼吉祥物 + 状态文字 + 会话数
│   │   ├── ExpandedPanel.vue     # 展开面板：TopBar + AgentGroup 列表，固定高度 370px
│   │   ├── TopBar.vue            # 顶部栏：ALL/STA/CLI 标签 + Canvas 吉祥物 + 关闭按钮
│   │   ├── AgentGroup.vue        # 按 agentType 分组（Claude/Codex/Gemini）
│   │   ├── SessionCard.vue       # 会话卡片：SVG 章鱼图标 + 项目名 + TerminalOutput + 状态标签
│   │   ├── TerminalOutput.vue    # 终端输出渲染：按类型着色，活跃状态展示默认提示文字
│   │   └── SettingsPanel.vue     # 设置面板（当前版本不渲染）
│   │
│   ├── stores/
│   │   └── notchStore.ts         # Pinia Store：会话状态、展开状态、标签过滤、mascotStatus 计算属性
│   ├── types/
│   │   └── index.ts              # TypeScript 类型：Session、SessionStatus、ElectronAPI 等
│   ├── services/
│   │   └── mockSessionService.ts # 浏览器开发环境下的模拟数据
│   ├── composables/
│   │   ├── useElectron.ts        # Electron API 类型化封装
│   │   ├── useWindowDrag.ts      # 窗口拖拽逻辑
│   │   └── useEdgeDock.ts        # 贴边吸附检测
│   ├── styles/
│   │   ├── variables.css         # CSS 变量（暗黑主题）
│   │   └── animations.css        # CSS 动画 keyframes
│   └── renderer/canvas/          # Canvas 2D 渲染引擎（与 Vue 解耦）
│       ├── canvas-renderer.ts    # CanvasRenderer：rAF 循环，路由到三种场景
│       ├── sprites.ts            # 颜色调色板、视口映射、手臂旋转数学
│       └── animations.ts         # 弹簧物理、关键帧插值、SpringAnimator
│
├── public/                       # 静态资源
│   └── resources/
│       ├── cli-icons/            # AI 助手图标（claude.png, codex.png, gemini.png）
│       └── sounds/               # 音效文件（预留）
│
└── docs/                         # 项目文档（修改代码必须同步更新）
    ├── requirements.md           # 需求文档（FR-1 ~ FR-7）
    ├── features.md               # 功能模块详细说明
    ├── changelog.md              # 版本更新日志
    ├── claude-session-format.md  # Claude Code 日志格式规范
    └── expanded-panel-roadmap.md # 展开面板功能路线图
```

## 文件导航

各目录下关键文件的一句话职责见项目根目录的 [`CLAUDE.md`](CLAUDE.md)。

## 数据流

```
~/.claude/sessions/*.json  +  ~/.claude/projects/<hash>/*.jsonl
              │
              ▼
    ┌─────────────────────┐
    │  ClaudeLogMonitor   │  ← 读取 & 解析日志文件
    │  (scanSessions)     │  ← 缓存 JSONL tail 读取
    └──────────┬──────────┘
               │ Session[]
               ▼
    ┌─────────────────────┐
    │  SessionManager     │  ← 1.5s 定时扫描
    │  (start/stop)       │  ← 聚合后推送到渲染进程
    └──────────┬──────────┘
               │ ipcMain → 'sessions:update'
               ▼
    ┌─────────────────────┐
    │  Pinia notchStore   │  ← sessions.value = newSessions
    │  (useNotchStore)    │  ← mascotStatus 计算属性实时反映状态
    └──────────┬──────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
CollapsedBar  ExpandedPanel  SessionCard
(mascotStatus) (groupedByAgent) (TerminalOutput)
```

## 状态映射

Claude Code 原始状态 → Vibe Notch 6 状态：

| 原始状态 | 条件 | Vibe Notch 状态 | 展示 |
|---------|------|----------------|------|
| `idle` | — | `sleeping` | 最后一行历史输出 |
| `waiting` | `waitingFor: "permission prompt"` | `waitingApproval` | `waiting...` |
| `busy` | 最后事件 `user` | `working` | `working...` |
| `busy` | 最后事件 `tool_use` | `tool_use` | `using tool...` |
| `busy` | 最后事件 `assistant` 含 thinking | `thinking` | `thinking...` |
| `busy` | 最后事件 `assistant` 无 thinking | `responding` | `responding...` |

## 核心类型

```typescript
type SessionStatus = 'thinking' | 'tool_use' | 'responding' | 'working' | 'waitingApproval' | 'sleeping'

interface Session {
  id: string
  projectName: string
  sessionNumber?: string
  agentType: 'claude' | 'codex' | 'gemini'
  terminalType: 'ghostty' | 'iterm2'
  status: SessionStatus
  lastOutput: OutputLine[]
  timestamp: number
  relativeTime: string
}

interface OutputLine {
  type: 'command' | 'output' | 'thinking' | 'link' | 'prompt'
  content: string
  linkUrl?: string
}
```

## License

MIT License
