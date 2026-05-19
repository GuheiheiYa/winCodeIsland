# Vibe Notch

> Claude Code Terminal Session Monitor - Dynamic Island for Windows

一个受 macOS 灵动岛启发的 Windows 桌面应用，用于监控 Claude Code、Codex、Gemini 等 AI 助手在终端中的活动状态。

## 特性

- **灵动岛式 UI**：悬浮在屏幕边缘的 pill 形状小条，显示实时工作状态
- **展开面板**：点击后展开为完整面板，按 AI 助手分组显示所有会话
- **毛玻璃效果**：使用 CSS `backdrop-filter` 实现现代感的半透明模糊效果
- **贴边吸附**：自动吸附到屏幕边缘（上/下/左/右）
- **系统托盘**：右键菜单支持显示/隐藏、开机启动、退出
- **实时终端输出**：带颜色区分的终端输出显示（命令、输出、链接、思考中）
- **CSS 动画**：所有动画使用 CSS keyframes，流畅且高性能

## 技术栈

- **Electron 28+** - 桌面应用框架
- **Vue 3** - 前端框架（Composition API + `<script setup>`）
- **TypeScript 5+** - 类型安全
- **Pinia** - 状态管理
- **Vite 5+** - 构建工具
- **electron-vite** - Electron + Vite 集成

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd vibe-notch

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 项目架构

```
vibe-notch/
├── electron/
│   ├── main.ts                 # 主进程入口
│   ├── preload.ts              # Preload 脚本（安全 API 暴露）
│   ├── windows/
│   │   └── notchWindow.ts      # 灵动岛窗口管理
│   ├── tray/
│   │   └── trayManager.ts      # 系统托盘
│   └── ipc/
│       └── ipcHandlers.ts      # IPC 处理器
├── src/
│   ├── main.ts                 # 渲染进程 Vue 入口
│   ├── App.vue                 # 根组件
│   ├── components/
│   │   ├── CollapsedBar.vue    # 收起状态（pill 小条）
│   │   ├── ExpandedPanel.vue   # 展开面板
│   │   ├── TopBar.vue          # 顶部栏（标签/按钮）
│   │   ├── AgentGroup.vue      # 助手分组（Claude/Codex/Gemini）
│   │   ├── SessionCard.vue     # 会话卡片
│   │   ├── TerminalOutput.vue  # 终端输出行
│   │   └── SettingsPanel.vue   # 设置面板
│   ├── stores/
│   │   └── notchStore.ts       # Pinia 状态管理
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义
│   ├── services/
│   │   └── mockSessionService.ts # 模拟数据服务
│   ├── composables/
│   │   ├── useWindowDrag.ts    # 拖拽逻辑
│   │   ├── useEdgeDock.ts      # 贴边吸附
│   │   └── useElectron.ts      # Electron API 封装
│   └── styles/
│       ├── variables.css       # CSS 变量（主题色）
│       └── animations.css      # CSS 动画定义
├── index.html
├── electron.vite.config.ts     # Vite 统一配置
├── tsconfig.json               # TypeScript 配置
├── tsconfig.node.json          # Node 端 TypeScript 配置
└── package.json
```

## 核心组件说明

### CollapsedBar（收起状态）

- Pill 形状小条（280x50px）
- 两个蓝色闪烁竖条 + "Working..." 文字
- 右侧显示总会话数
- 点击后展开为完整面板

### ExpandedPanel（展开面板）

- 面板尺寸 420x580px
- 顶部栏：ALL/STA/CLI 标签切换 + 音量/设置/关闭按钮
- 助手分组：Claude（橙色太阳图标）、Codex（紫色图标）、Gemini（紫色钻石图标）
- 会话卡片：像素风项目图标、终端输出、状态指示

### SessionCard（会话卡片）

- 像素风项目图标（城堡/骷髅/星星）
- 项目名称 + 会话 ID
- 时间标签（1h、<1m、1m）
- 终端类型标签（Ghostty/iTerm2 + 彩色圆点）
- 终端输出（带颜色：$灰色、>绿色、链接蓝色）
- 状态：sleeping（zzz）、thinking（光标闪烁）

## 数据模型

### Session（会话）

```typescript
interface Session {
  id: string              // 唯一 ID
  projectName: string      // 项目名称
  sessionNumber?: string   // 会话编号（如 #8387）
  agentType: AgentType     // 助手类型：claude | codex | gemini
  terminalType: TerminalType // 终端类型：ghostty | iterm2
  status: SessionStatus    // 状态：working | sleeping | thinking
  lastOutput: OutputLine[] // 最近的终端输出
  timestamp: number        // 时间戳
  relativeTime: string     // 相对时间（如 1h、<1m）
}
```

### OutputLine（终端输出行）

```typescript
interface OutputLine {
  type: 'command' | 'output' | 'thinking' | 'link' | 'prompt'
  content: string
  linkUrl?: string  // 链接类型时必填
}
```

## CSS 变量

```css
:root {
  --bg-primary: #0d0d1a;
  --bg-secondary: rgba(20, 20, 35, 0.95);
  --bg-card: rgba(35, 35, 50, 0.85);
  --text-primary: #f0f0f5;
  --text-secondary: rgba(240, 240, 245, 0.65);
  --text-muted: rgba(240, 240, 245, 0.4);
  --accent-green: #4ade80;
  --accent-blue: #60a5fa;
  --accent-orange: #fb923c;
  --accent-purple: #c084fc;
  --border-color: rgba(255, 255, 255, 0.06);
  --radius-full: 9999px;
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.4);
  --backdrop-blur: blur(24px) saturate(1.2);
}
```

## IPC 通信

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `window:toggle-expand` | Renderer → Main | 切换展开/收起 |
| `window:set-expanded` | Renderer → Main | 设置展开状态 |
| `window:dock` | Renderer → Main | 贴边 |
| `window:show/hide` | Renderer → Main | 显示/隐藏窗口 |
| `sessions:update` | Main → Renderer | 会话数据更新 |
| `settings:get/set` | Renderer ↔ Main | 获取/设置配置 |
| `app:quit` | Renderer → Main | 退出应用 |

## 开发计划

- [x] 基础窗口系统（无边框、置顶、拖拽）
- [x] 收起/展开动画
- [x] 贴边吸附
- [x] 系统托盘
- [x] 会话数据模型
- [x] 模拟数据服务
- [x] 毛玻璃 UI
- [x] CSS 动画
- [x] 设置面板
- [ ] 真实终端数据抓取（需集成 node-pty）
- [ ] 声音提示
- [ ] 多显示器支持
- [ ] 主题系统完善

## License

MIT License
