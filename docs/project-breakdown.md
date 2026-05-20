# Vibe Notch — 完整项目拆分手册

> 逐文件、逐函数拆解整个项目，包含主进程、渲染进程、构建配置的完整说明。

---

## 目录

1. [项目结构总览](#一项目结构总览)
2. [构建系统](#二构建系统)
3. [主进程（Electron Main）](#三主进程electron-main)
4. [Preload 脚本](#四preload-脚本)
5. [渲染进程（Vue 前端）](#五渲染进程vue-前端)
6. [数据流全景](#六数据流全景)
7. [文件依赖矩阵](#七文件依赖矩阵)

---

## 一、项目结构总览

```
winCodeIsland/
├── package.json                    # 项目配置 + 依赖 + 脚本
├── electron.vite.config.ts         # 三进程构建配置（main/preload/renderer）
├── tsconfig.json                   # TypeScript 编译配置
├── tsconfig.node.json              # Node 环境 TS 配置
├── index.html                      # 渲染进程 HTML 入口
│
├── electron/                       # 主进程代码
│   ├── main.ts                     # 应用入口：生命周期 + 模块编排
│   ├── preload.ts                  # 预加载脚本：安全暴露 API
│   ├── windows/
│   │   └── notchWindow.ts          # 灵动岛窗口管理器
│   ├── ipc/
│   │   └── ipcHandlers.ts          # IPC 处理器注册 + 设置存储
│   ├── tray/
│   │   └── trayManager.ts          # 系统托盘管理
│   └── services/
│       ├── sessionManager.ts       # 会话管理器（定时推送）
│       └── claudeLogMonitor.ts     # Claude 日志监控 + 状态分析
│
├── src/                            # 渲染进程代码
│   ├── main.ts                     # Vue 应用入口
│   ├── App.vue                     # 根组件（收起/展开状态切换）
│   ├── types/
│   │   └── index.ts                # 全项目类型定义
│   │
│   ├── stores/
│   │   └── notchStore.ts           # Pinia 状态管理（核心数据中枢）
│   │
│   ├── composables/
│   │   ├── useElectron.ts          # Electron API 封装（IPC 调用）
│   │   ├── useWindowDrag.ts        # 窗口拖拽逻辑
│   │   └── useEdgeDock.ts          # 贴边吸附逻辑
│   │
│   ├── components/
│   │   ├── CollapsedBar.vue        # 收起状态：Pill 小条 + Canvas 章鱼
│   │   ├── ExpandedPanel.vue       # 展开状态：完整面板
│   │   ├── TopBar.vue              # 顶部栏：标签 + 按钮
│   │   ├── AgentGroup.vue          # 助手分组（Claude/Codex/Gemini）
│   │   ├── SessionCard.vue         # 单个会话卡片
│   │   ├── TerminalOutput.vue      # 终端输出行
│   │   └── SettingsPanel.vue       # 设置弹窗
│   │
│   ├── renderer/canvas/
│   │   ├── canvas-renderer.ts      # Canvas 2D 渲染引擎
│   │   ├── sprites.ts              # 精灵定义：颜色、坐标、手臂路径
│   │   └── animations.ts           # 动画系统：Spring 物理、关键帧
│   │
│   ├── services/
│   │   ├── soundService.ts         # 音效服务（Web Audio API）
│   │   └── mockSessionService.ts   # 模拟数据生成器
│   │
│   └── styles/
│       ├── variables.css           # CSS 变量（色彩系统）
│       └── animations.css          # 全局动画 keyframes
│
├── public/                         # 静态资源
└── out/                            # 构建输出目录
    ├── main/                       # 主进程编译输出
    ├── preload/                    # preload 编译输出
    └── renderer/                   # 渲染进程构建输出
```

---

## 二、构建系统

### 2.1 package.json

```json
{
  "name": "vibe-notch",
  "main": "./out/main/main.js",      // Electron 入口
  "scripts": {
    "dev": "electron-vite dev",       // 开发模式（热更新）
    "build": "electron-vite build",   // 生产构建
    "preview": "electron-vite preview",
    "typecheck": "vue-tsc --noEmit"   // 类型检查
  }
}
```

**依赖说明：**

| 依赖 | 版本 | 用途 |
|------|------|------|
| `electron` | ^28.0.0 | Electron 框架 |
| `electron-vite` | ^2.0.0 | 三进程构建工具 |
| `vue` | ^3.4.0 | 前端框架 |
| `pinia` | ^2.1.0 | 状态管理 |
| `marked` | ^18.0.4 | Markdown 渲染 |
| `node-pty` | ^1.1.0 | 终端 PTY（预留） |
| `strip-ansi` | ^7.2.0 | ANSI 转义序列去除 |

### 2.2 electron.vite.config.ts

三进程并行构建配置：

| 进程 | 入口 | 输出 | 格式 | 工具 |
|------|------|------|------|------|
| **main** | `electron/main.ts` | `out/main/` | CJS | esbuild (via electron-vite) |
| **preload** | `electron/preload.ts` | `out/preload/` | CJS | esbuild |
| **renderer** | `index.html` | `out/renderer/` | ESM | Vite + @vitejs/plugin-vue |

**路径别名：**
- `@/` → `src/`
- `@electron/` → `electron/`

---

## 三、主进程（Electron Main）

### 3.1 electron/main.ts — 应用入口

**职责：** 应用生命周期管理、模块初始化编排。

**全局变量：**

| 变量 | 类型 | 说明 |
|------|------|------|
| `notchWindowManager` | `NotchWindowManager \| null` | 窗口管理器实例 |
| `trayManager` | `TrayManager \| null` | 托盘管理器实例 |
| `sessionManager` | `SessionManager \| null` | 会话管理器实例 |

**函数：**

#### `createApp(): Promise<void>`
初始化顺序：
1. `new NotchWindowManager().create()` → 创建 BrowserWindow
2. `mainWindow.loadURL/loadFile()` → 加载渲染进程
3. `registerIpcHandlers(mainWindow)` → 注册 IPC 处理器
4. `new TrayManager().create(mainWindow)` → 创建系统托盘
5. `new SessionManager()` → 初始化会话管理器
   - `sessionManager.attach(mainWindow)` → 绑定窗口
   - `setSessionManager(sessionManager)` → 供 IPC 处理器使用
   - `sessionManager.start()` → 启动定时监控

**生命周期钩子：**

| 事件 | 触发条件 | 处理 |
|------|---------|------|
| `app.whenReady()` | Electron 初始化完成 | 调用 `createApp()` |
| `app.on('activate')` | macOS 点击 dock | 重新创建窗口 |
| `app.on('window-all-closed')` | 所有窗口关闭 | 非 macOS 退出 |
| `app.on('before-quit')` | 应用即将退出 | `sessionManager?.stop()`, `trayManager?.destroy()`, `notchWindowManager?.destroy()` |

---

### 3.2 electron/windows/notchWindow.ts — 窗口管理器

**类：** `NotchWindowManager`

**职责：** 创建和管理无边框置顶窗口，处理尺寸切换、拖拽、贴边吸附。

**私有属性：**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `window` | `BrowserWindow \| null` | null | 窗口实例 |
| `isExpanded` | `boolean` | false | 当前展开状态 |
| `dockPosition` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'none'` | 'none' | 贴边位置 |
| `dragOffset` | `{x, y}` | {0,0} | 拖拽偏移量 |
| `isDragging` | `boolean` | false | 是否正在拖拽 |
| `snapThreshold` | `number` | 40 | 贴边吸附阈值（像素） |
| `collapsedWidth` | `number` | 300 | 收起宽度 |
| `collapsedHeight` | `number` | 36 | 收起高度 |
| `expandedWidth` | `number` | 560 | 展开宽度 |
| `expandedFixedHeight` | `number` | 370 | 展开固定高度 |

**方法：**

#### `create(): BrowserWindow`
创建窗口，配置参数：
- `frame: false` — 无边框
- `alwaysOnTop: true` + `setAlwaysOnTop(true, 'screen-saver')` — 置顶
- `transparent: true` + `backgroundColor: '#00000000'` — 透明
- `skipTaskbar: true` — 不显示在任务栏
- `resizable/maximizable/minimizable/fullscreenable: false` — 禁用窗口操作
- `type: 'toolbar'` — Windows 工具窗口类型
- `setIgnoreMouseEvents(true, { forward: true })` — 透明区域鼠标穿透

#### `setupDragListeners(): void`
监听 `webContents 'ipc-message'` 事件：
- `drag-start` → 记录拖拽起始偏移量
- `drag-move` → 实时更新窗口位置
- `drag-end` → 调用 `checkEdgeSnap()`

#### `setupIpcListeners(): void`
监听渲染进程发来的窗口控制指令：
- `window:toggle-expand` → `toggleExpand()`
- `window:set-expanded` → `setExpanded(args[0])`
- `window:dock` → `dockToEdge(args[0])`

#### `toggleExpand(): void`
切换展开/收起状态。

#### `setExpanded(expanded: boolean): void`
核心方法：改变窗口尺寸并通知渲染进程。

**展开时：**
- 宽度：560px
- 高度：min(370px, 屏幕高度 × 0.8)
- X：居中
- Y：紧贴屏幕顶部

**收起时：**
- 宽度：300px
- 高度：36px
- X：居中
- Y：紧贴屏幕顶部

通知：`webContents.send('window:expand-changed', expanded)`

#### `checkEdgeSnap(): void`
拖拽结束后检测贴边：
- 距顶部 ≤40px → `dockPosition = 'top'`
- 距底部 ≤40px → `dockPosition = 'bottom'`
- 距左边 ≤40px → `dockPosition = 'left'`
- 距右边 ≤40px → `dockPosition = 'right'`

贴边后发送：`webContents.send('window:dock', position)`

#### `dockToEdge(position): void`
主动贴边到指定位置，计算对应坐标并 `setPosition()`。

---

### 3.3 electron/ipc/ipcHandlers.ts — IPC 处理器

**职责：** 注册所有 `ipcMain` 事件处理器，作为渲染进程和主进程之间的桥梁。

**模块级变量：**

| 变量 | 类型 | 说明 |
|------|------|------|
| `defaultSettings` | `AppSettings` | 默认设置对象 |
| `currentSettings` | `AppSettings` | 当前设置（内存存储） |
| `sessionManager` | `SessionManager \| null` | 会话管理器引用 |

**导出函数：**

#### `setSessionManager(manager: SessionManager): void`
由 `main.ts` 调用，注入会话管理器实例。

#### `registerIpcHandlers(mainWindow: BrowserWindow): void`
注册所有 IPC 处理器：

**渲染 → 主（`ipcMain.on`）：**

| 通道 | 参数 | 处理 |
|------|------|------|
| `window:toggle-expand` | — | 转发到渲染进程 `window:toggle-expand` |
| `window:set-expanded` | `expanded: boolean` | 转发到渲染进程 `window:expand-changed` |
| `window:dock` | `position: DockPosition` | 转发到渲染进程 `window:dock` |
| `window:show` | — | `notchWindow.show()` + `setSkipTaskbar(true)` |
| `window:hide` | — | `notchWindow.hide()` |
| `settings:set` | `settings: AppSettings` | 更新 `currentSettings`，广播 `settings:changed` |
| `app:quit` | — | `notchWindow.close()` |
| `window:set-mouse-ignore` | `ignore: boolean` | Windows 下 `setIgnoreMouseEvents(ignore, {forward:true})` |
| `terminal:focus` | `pid: number` | PowerShell `AppActivate(pid)` 激活终端 |

**渲染 → 主（`ipcMain.handle`，同步返回）：**

| 通道 | 返回 | 处理 |
|------|------|------|
| `settings:get` | `AppSettings` | 返回 `currentSettings` |
| `session:create` | — | 抛出错误（已禁用手动创建） |

**主 → 渲染（主动推送）：**

| 函数 | 通道 | 数据 |
|------|------|------|
| `updateSessions()` | `sessions:update` | `Session[]` |

---

### 3.4 electron/tray/trayManager.ts — 系统托盘

**类：** `TrayManager`

**职责：** 创建和管理系统托盘图标、右键菜单。

**方法：**

#### `create(mainWindow): Tray`
1. 加载托盘图标（`resources/tray-icon.png`，失败则生成空白图标）
2. 创建 `Tray` 实例
3. 设置右键菜单（显示/隐藏、开机启动、退出）
4. 左键点击切换窗口显示/隐藏

**右键菜单项：**

| 标签 | 类型 | 动作 |
|------|------|------|
| Show/Hide Vibe Notch | 普通 | `toggleWindow()` |
| Auto Start | 复选框 | `app.setLoginItemSettings()` |
| Quit | 普通 | `app.quit()` |

---

### 3.5 electron/services/sessionManager.ts — 会话管理器

**类：** `SessionManager`

**职责：** 定时扫描 Claude 日志，推送会话数据到渲染进程。

**属性：**

| 属性 | 类型 | 说明 |
|------|------|------|
| `monitor` | `ClaudeLogMonitor` | 日志监控器实例 |
| `mainWindow` | `BrowserWindow \| null` | 绑定的主窗口 |
| `pushTimer` | `ReturnType<typeof setInterval> \| null` | 定时器句柄 |
| `isRunning` | `boolean` | 是否运行中 |

**方法：**

| 方法 | 说明 |
|------|------|
| `attach(window)` | 绑定主窗口 |
| `start()` | 立即推送一次 + 每 1.5s 定时推送 |
| `stop()` | 清除定时器 |
| `getAllSessions()` | 返回 `monitor.scanSessions()` |
| `pushSessions()` | 获取会话 → 调用 `updateSessions(mainWindow, sessions)` |

---

### 3.6 electron/services/claudeLogMonitor.ts — 日志监控器

**类：** `ClaudeLogMonitor`

**职责：** 读取 Claude Code 本地日志文件，解析会话状态和终端输出。

**监控的文件路径：**

| 文件类型 | 路径 | 说明 |
|---------|------|------|
| 会话状态 | `~/.claude/sessions/*.json` | 每个会话一个 JSON 文件 |
| 终端日志 | `~/.claude/projects/<hash>/*.jsonl` | JSON Lines 格式事件流 |

**核心方法：**

#### `scanSessions(): Session[]`
1. `readdirSync(sessionsDir)` 获取所有 `.json` 文件
2. 对每个文件调用 `readSession()`
3. 过滤掉 `kind !== 'interactive' || entrypoint !== 'cli'`

#### `readSession(filename): Session | null`
1. 读取并解析 JSON
2. 提取 `projectName`（从 `cwd` 路径）
3. 调用 `analyzeSession()` 获取状态和输出
4. 计算 `relativeTime`
5. 返回 `Session` 对象

#### `analyzeSession(state): {status, lastOutput}`
**状态判断逻辑：**

```
state.status === 'idle'     → sleeping
state.status === 'waiting'  → waitingApproval
└─ 读取 JSONL 最后事件：
   lastEvent.type === 'user'       → working
   lastEvent.type === 'tool_use'   → tool_use
   lastEvent.type === 'assistant/message' + 含 thinking → thinking
   lastEvent.type === 'assistant/message' + 无 thinking → responding
   其他 → 查找最近 thinking 事件（10s内 thinking，否则 working）
```

#### `buildOutputLines(events, status, lastThinkingEvt): OutputLine[]`
- 活跃状态（非 sleeping）：返回空数组（由 `TerminalOutput.vue` 显示状态提示）
- sleeping：返回最后一行有意义的输出

#### `readJsonlTail(filePath, lineCount): JsonlEvent[]`
带缓存的增量读取：
1. `statSync` 获取文件大小
2. 如果大小未变且缓存存在 → 返回缓存
3. 否则读取整个文件 → 缓存最后 N 行 → 返回解析后的事件

**辅助函数（模块级）：**

| 函数 | 用途 |
|------|------|
| `truncate(str, max)` | 截断字符串，超出加 `…` |
| `extractTextContent(content)` | 从 message.content 提取纯文本 |
| `extractThinkingFromContent(content)` | 提取 thinking 文本 |
| `hasThinkingContent(content)` | 检查是否包含 thinking |

---

## 四、Preload 脚本

### 4.1 electron/preload.ts — API 暴露层

**职责：** 通过 `contextBridge` 将 Electron API 安全暴露给渲染进程。

**暴露的 API（`window.electronAPI`）：**

```typescript
window.electronAPI = {
  // 窗口控制
  toggleExpand: () => ipcRenderer.send('window:toggle-expand'),
  setExpanded: (expanded) => ipcRenderer.send('window:set-expanded', expanded),
  dockWindow: (position) => ipcRenderer.send('window:dock', position),
  showWindow: () => ipcRenderer.send('window:show'),
  hideWindow: () => ipcRenderer.send('window:hide'),
  quitApp: () => ipcRenderer.send('app:quit'),

  // 会话监听（返回取消订阅函数）
  onSessionsUpdate: (callback) => {
    const handler = (_, sessions) => callback(sessions)
    ipcRenderer.on('sessions:update', handler)
    return () => ipcRenderer.removeListener('sessions:update', handler)
  },

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.send('settings:set', settings),
  onSettingsChanged: (callback) => { ... },

  // 展开状态
  onExpandChanged: (callback) => { ... },

  // 鼠标穿透
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('window:set-mouse-ignore', ignore),

  // 聚焦终端
  focusTerminal: (pid) => ipcRenderer.invoke('terminal:focus', pid),

  // 平台信息
  platform: process.platform
}
```

**设计原则：**
- 不直接暴露 `ipcRenderer`，而是包装为语义化 API
- 所有监听函数返回清理函数（`() => void`），便于 Vue 组件卸载时取消订阅
- `contextIsolation: true` 保证安全隔离

---

## 五、渲染进程（Vue 前端）

### 5.1 src/types/index.ts — 类型定义中心

**核心类型：**

| 类型 | 定义 | 说明 |
|------|------|------|
| `SessionStatus` | `'thinking' \| 'tool_use' \| 'responding' \| 'working' \| 'waitingApproval' \| 'sleeping'` | 会话状态枚举 |
| `AgentType` | `'claude' \| 'codex' \| 'gemini'` | 助手类型 |
| `TerminalType` | `'ghostty' \| 'iterm2'` | 终端类型 |
| `DockPosition` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'none'` | 贴边位置 |
| `OutputLine` | `{type, content, linkUrl?}` | 终端输出行 |
| `Session` | `{id, projectName, sessionNumber?, pid?, agentType, terminalType, status, lastOutput[], timestamp, relativeTime}` | 会话对象 |
| `AgentGroupData` | `{agentType, agentName, sessions[]}` | 助手分组 |
| `AppSettings` | `{autoStart, edgeDock, theme, shortcut, opacity, soundEnabled}` | 应用设置 |
| `ElectronAPI` | 接口定义 | preload 暴露的 API 类型 |

**全局声明：**
```typescript
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

---

### 5.2 src/main.ts — Vue 应用入口

**流程：**
1. `createApp(App)` — 创建 Vue 应用
2. `createPinia()` — 创建 Pinia 状态管理
3. `app.use(pinia)` — 注册 Pinia
4. `app.mount('#app')` — 挂载到 `#app`
5. 导入全局样式：`variables.css` + `animations.css`

---

### 5.3 src/App.vue — 根组件

**状态：** 通过 `useNotchStore()` 获取全局状态。

**渲染逻辑：**

```vue
<!-- 收起状态 -->
<CollapsedBar v-if="!store.isExpanded" @expand="handleToggleExpand" />

<!-- 展开状态 -->
<ExpandedPanel v-else @collapse="handleToggleExpand" />
```

**初始化流程 `initializeApp()`：**

| 步骤 | 操作 | 数据来源 |
|------|------|---------|
| 1 | `getSettings()` | 主进程内存存储 |
| 2 | `onSessionsUpdate(callback)` | 主进程 `sessionManager` 推送 |
| 3 | `onExpandChanged(callback)` | 主进程 `notchWindow` 通知 |
| 4 | `onSettingsChanged(callback)` | 主进程设置变更广播 |
| 5 | `playBootSound()` | 播放启动音效 |
| 6 | `setupMouseIgnore()` | Windows 透明区域鼠标穿透 |

**点击外部收起：**
- 监听 `document mousedown`
- 如果点击目标不在 `.collapsed-bar` / `.expanded-panel` / `.settings-panel` 内 → `store.setExpanded(false)`

---

### 5.4 src/stores/notchStore.ts — Pinia 状态管理

**这是整个前端的数据中枢。**

**State（响应式数据）：**

| 字段 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| `isExpanded` | `boolean` | false | 展开/收起 |
| `activeTab` | `'all' \| 'sta' \| 'cli'` | 'all' | 当前标签 |
| `sessions` | `Session[]` | [] | 当前会话列表 |
| `previousSessions` | `Session[]` | [] | 上一次会话列表（用于检测变化） |
| `dockPosition` | `DockPosition` | 'none' | 贴边位置 |
| `settings` | `AppSettings` | 默认值 | 应用设置 |
| `isSettingsOpen` | `boolean` | false | 设置面板是否打开 |

**Getters（计算属性）：**

| Getter | 计算逻辑 | 用途 |
|--------|---------|------|
| `mascotStatus` | 过滤非 sleeping 会话 → 有 waitingApproval 则返回 waitingApproval，否则 processing，无则为 idle | CollapsedBar/TopBar 的章鱼状态 |
| `sessionCount` | `sessions.length` | 显示总会话数 |
| `workingCount` | 过滤非 sleeping 的数量 | — |
| `groupedByAgent` | 按 `agentType` 分组 → 每组内按状态排序 | ExpandedPanel 的分组渲染 |
| `filteredSessions` | 根据 `activeTab` 过滤 | ALL=全部, STA=sleeping/thinking/waitingApproval, CLI=tool_use/responding/working |

**Actions（方法）：**

| 方法 | 说明 |
|------|------|
| `toggleExpand()` | 切换展开状态 → 通知主进程 `setExpanded()` |
| `setExpanded(expanded)` | 直接设置展开状态 |
| `setActiveTab(tab)` | 切换标签 |
| `updateSessions(newSessions)` | 检测状态变化 → 触发音效 → 更新 sessions |
| `detectStateChanges(prev, curr)` | 对比前后状态，决定播放哪种音效 |
| `dockToEdge(position)` | 贴边 → 通知主进程 |
| `updateSettings(partial)` | 合并设置 → 同步音效开关 → 通知主进程 |
| `playBootSound()` | 播放启动音效 |

**音效触发规则：**

| 状态变化 | 音效 |
|---------|------|
| sleeping → working/thinking/tool_use/responding | `start` |
| any → waitingApproval | `approval` |
| working/thinking/.../waitingApproval → sleeping | `complete` |

---

### 5.5 src/composables/useElectron.ts — IPC 封装

**职责：** 提供类型安全的 Electron API 调用，处理 `window.electronAPI` 不存在的情况（浏览器环境）。

**导出函数：**

| 函数 | 对应 API | 返回值 |
|------|---------|--------|
| `toggleExpand()` | `electronAPI.toggleExpand()` | void |
| `setExpanded(expanded)` | `electronAPI.setExpanded(expanded)` | void |
| `dockWindow(position)` | `electronAPI.dockWindow(position)` | void |
| `showWindow()` | `electronAPI.showWindow()` | void |
| `hideWindow()` | `electronAPI.hideWindow()` | void |
| `quitApp()` | `electronAPI.quitApp()` | void |
| `getSettings()` | `electronAPI.getSettings()` | `Promise<AppSettings \| null>` |
| `setSettings(settings)` | `electronAPI.setSettings(settings)` | void |
| `onSessionsUpdate(cb)` | `electronAPI.onSessionsUpdate(cb)` | `(() => void) \| undefined` |
| `onSettingsChanged(cb)` | `electronAPI.onSettingsChanged(cb)` | `(() => void) \| undefined` |
| `onExpandChanged(cb)` | `electronAPI.onExpandChanged(cb)` | `(() => void) \| undefined` |
| `isElectron()` | 检查 `window.electronAPI` 存在 | boolean |
| `getPlatform()` | `electronAPI.platform` | string |

**Vue Composable：**
```typescript
useElectronIpc(onSessions?, onSettings?, onExpand?)
// 自动在 onMounted 注册监听，onUnmounted 取消订阅
```

---

### 5.6 src/composables/useWindowDrag.ts — 拖拽逻辑

**职责：** 处理无边框窗口的鼠标拖拽。

**注意：** 当前实现使用 `CustomEvent` 而非标准 IPC。渲染进程触发 CustomEvent → 被主进程的 `webContents.on('ipc-message')` 捕获（实际上这个实现有问题，应该用 `ipcRenderer.send`）。

**导出：**
- `isDragging: Ref<boolean>`
- `startDrag(event: MouseEvent): void`

---

### 5.7 src/composables/useEdgeDock.ts — 贴边逻辑

**职责：** 检测窗口是否靠近屏幕边缘。

**导出：**
- `dockPosition: Ref<DockPosition>`
- `isDocked: Ref<boolean>`
- `checkAndDock(x, y, width, height, screenWidth, screenHeight, threshold=40)`
- `dockTo(position)`
- `undock()`

---

### 5.8 src/components/CollapsedBar.vue — 收起状态

**UI 结构：**

```
┌─────────────────────────────────────┐
│ 🐙  运行中...        3 个会话        │
└─────────────────────────────────────┘
```

**数据来源：**
- `store.mascotStatus` → `statusMeta`（颜色、文字、发光效果）
- `store.sessionCount` → 会话数量

**子组件/元素：**
- `canvas` → `CanvasRenderer`（像素章鱼动画）
- `status-text` → 状态文字 + 动态省略号（450ms 循环）
- `session-count` → 会话数

**动画：**
- 章鱼：Canvas rAF 循环（根据 mascotStatus 切换场景）
- 省略号：`['', '.', '..', '...']` 每 450ms 切换

**点击：** `emit('expand')` → App.vue → store.toggleExpand()

---

### 5.9 src/components/ExpandedPanel.vue — 展开状态

**UI 结构：**

```
┌──────────────────────────────────────────┐
│ TopBar                                   │
├──────────────────────────────────────────┤
│ ┌─ Claude (3) ────────────────────────┐  │
│ │ AgentGroup                          │  │
│ │ ├─ SessionCard                      │  │
│ │ ├─ SessionCard                      │  │
│ │ └─ SessionCard                      │  │
│ └─────────────────────────────────────┘  │
│ ┌─ Codex (1) ─────────────────────────┐  │
│ └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**数据来源：**
- `store.groupedByAgent` → 遍历渲染 AgentGroup
- `store.sessionCount === 0` → 显示空状态

**子组件：**
- `TopBar.vue` → 顶部栏
- `AgentGroup.vue` → 助手分组（v-for）

**点击会话：** `handleSessionClick(session)` → `window.electronAPI.focusTerminal(pid)`

---

### 5.10 src/components/TopBar.vue — 顶部栏

**UI 结构：**

```
┌─────────────────────────────────────────────┐
│ 🐙  [ALL] [STA] [CLI]          🔊  ⏻       │
└─────────────────────────────────────────────┘
```

**数据来源：**
- `store.activeTab` → 标签选中状态
- `store.mascotStatus` → Canvas 章鱼图标

**子组件/元素：**
- `canvas` → `CanvasRenderer`（28×24 小章鱼）
- `tab-btn` × 3 → ALL / STA / CLI
- `icon-btn` × 2 → 音量、关闭

**标签过滤逻辑（在 notchStore.ts 中）：**

| 标签 | 过滤条件 |
|------|---------|
| ALL | 不过滤 |
| STA | `sleeping \| thinking \| waitingApproval` |
| CLI | `tool_use \| responding \| working` |

**点击标签：** `store.setActiveTab(tab)`
**点击关闭：** `emit('collapse')`

---

### 5.11 src/components/AgentGroup.vue — 助手分组

**Props：**
- `group: AgentGroupData` — 包含 `agentType`、`agentName`、`sessions[]`

**UI：**
- 助手图标（`/resources/cli-icons/claude.png`）
- 助手名称 + 会话数量
- 遍历 `group.sessions` 渲染 `SessionCard`

**点击：** `emit('sessionClick', session)` → ExpandedPanel.vue

---

### 5.12 src/components/SessionCard.vue — 会话卡片

**Props：**
- `session: Session`

**UI 结构：**

```
┌──────────────────────────────────────────────────────┐
│ ┌──┐  ┌──────────────────────────┐  ┌─────────────┐ │
│ │🐙│  │ project-name    #123     │  │ 5m    →     │ │
│ │  │  │ ──────────────────────── │  │  iterm2     │ │
│ │  │  │ $ npm run dev            │  │             │ │
│ └──┘  └──────────────────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────┘
```

**状态图标映射：**

| 状态 | 图标类型 | SVG 特征 |
|------|---------|---------|
| sleeping | sleeping | 闭眼 + Zzz 浮动动画 |
| working | working | 键盘 + 手臂打字动画 |
| thinking / waitingApproval | thinking | 大眼 + 感叹号 + 红色光晕 |
| tool_use / responding | working | 同 working |

**数据来源：**
- `props.session` → 全部显示数据
- `statusIcon` computed → 状态到图标的映射
- `lastLine` computed → 空闲时显示的最后一行输出

**子组件：**
- `TerminalOutput.vue`（条件渲染：`!isIdle`）

---

### 5.13 src/components/TerminalOutput.vue — 终端输出

**Props：**
- `lines: OutputLine[]`
- `status: SessionStatus`

**行类型样式：**

| type | 前缀 | 颜色 |
|------|------|------|
| prompt | `$ ` | 白色 |
| output | `> ` | 绿色 |
| thinking | — | 灰色 + 光标闪烁 |
| command | `$ ` | 白色 |
| link | — | 蓝色，可点击 |

**空内容时显示状态提示：**

| status | 提示文字 |
|--------|---------|
| thinking | `thinking...` |
| tool_use | `using tool...` |
| responding | `responding...` |
| working | `working...` |
| waitingApproval | `waiting...` |

---

### 5.14 src/components/SettingsPanel.vue — 设置弹窗

**数据来源：** `store.settings`

**设置项：**

| 设置 | 类型 | 控件 |
|------|------|------|
| 开机启动 | boolean | Toggle Switch |
| 贴边吸附 | boolean | Toggle Switch |
| 主题 | `'dark' \| 'light' \| 'auto'` | 三按钮选择 |
| 快捷键 | string | 只读显示 |

**点击遮罩层：** `handleClose()` → `store.closeSettings()`

---

### 5.15 Canvas 渲染引擎

#### src/renderer/canvas/canvas-renderer.ts

**类：** `CanvasRenderer`

**职责：** rAF 动画循环 + 场景路由。

**核心方法：**

| 方法 | 说明 |
|------|------|
| `constructor(canvas)` | 获取 2D context，设置 `imageSmoothingEnabled = false` |
| `startLoop(getStatus)` | 启动 rAF 循环，每帧调用 `render(t, status)` |
| `stopLoop()` | 取消 rAF |
| `setSpeed(speed)` | 设置动画速度系数 |
| `render(t, status)` | 根据状态路由到对应场景 |

**场景路由：**

| status | 场景方法 | 特征 |
|--------|---------|------|
| `idle` | `renderSleepScene()` | 呼吸 + Zzz 浮动 |
| `processing` / `running` | `renderWorkScene()` | 弹跳 + 键盘 + 手臂打字 |
| `waitingApproval` / `waitingQuestion` | `renderAlertScene()` | 跳跃 + 红色光晕 + 感叹号 |

#### src/renderer/canvas/sprites.ts

**导出：**

| 名称 | 类型 | 说明 |
|------|------|------|
| `CLAWD_COLORS` | 对象 | 章鱼身体 `#DE886D`、眼睛 `#000000`、警告 `#FF3D00`、键盘底座 `#617080`、按键 `#99A9B8` |
| `SCENE_VIEWPORTS` | 对象 | 三个场景的 SVG 视口参数 |
| `createViewportMapper()` | 函数 | 创建坐标映射器 |
| `mapRect()` | 函数 | SVG 坐标 → Canvas 像素矩形 |
| `armPath()` | 函数 | 计算旋转后的手臂多边形顶点 |
| `drawArmPolygon()` | 函数 | 绘制填充多边形 |

#### src/renderer/canvas/animations.ts

**导出：**

| 名称 | 类型 | 说明 |
|------|------|------|
| `springValue()` | 函数 | 弹簧物理模拟（阻尼谐振子） |
| `SpringAnimator` | 类 | rAF 驱动的 Spring 动画 |
| `lerp()` / `lerpKeyframes()` | 函数 | 线性插值 / 关键帧插值 |
| `MorphTextAnimator` | 类 | 文字模糊过渡动画 |
| `blurFadeTransition()` | 函数 | 内容切换的 blurFade 过渡 |
| `ALERT_JUMP_KEYFRAMES` | 数组 | Alert 场景跳跃 Y 位移关键帧 |
| `ALERT_ARM_LEFT/RIGHT_KEYFRAMES` | 数组 | 手臂挥舞角度关键帧 |
| `ALERT_BANG_SCALE/OPACITY_KEYFRAMES` | 数组 | 感叹号缩放/透明度关键帧 |

---

### 5.16 src/services/soundService.ts — 音效服务

**类：** `SoundService`（单例导出 `soundService`）

**音效文件：**

| 类型 | 文件 | 冷却时间 |
|------|------|---------|
| boot | `8bit_boot.wav` | 0（只播一次） |
| start | `8bit_start.wav` | 2000ms |
| complete | `8bit_complete.wav` | 2000ms |
| approval | `8bit_approval.wav` | 3000ms |
| error | `8bit_error.wav` | 1000ms |
| submit | `8bit_submit.wav` | 1000ms |

**方法：**
- `setEnabled(enabled)` — 开关音效
- `play(type, force?)` — 播放（检查冷却）
- `playBoot()` — 播放启动音效（只一次）

---

### 5.17 src/services/mockSessionService.ts — 模拟数据

**开发模式使用（浏览器环境无 electronAPI 时）。**

**导出函数：**

| 函数 | 说明 |
|------|------|
| `createSession(partial?)` | 生成单个模拟 Session |
| `generateInitialSessions()` | 生成 10 个预设会话（匹配设计图） |
| `simulateSessionUpdates(sessions)` | 模拟 thinking 光标闪烁 |
| `startMockUpdates(callback, interval=600)` | 启动定时更新，返回清理函数 |

---

### 5.18 样式系统

#### src/styles/variables.css

定义 CSS 变量：
- 背景色（`--bg-panel`, `--bg-secondary` 等）
- 文字色（`--text-primary`, `--text-muted` 等）
- 强调色（`--accent-green`, `--accent-blue`, `--accent-orange`）
- 边框、圆角、阴影、毛玻璃效果
- 间距、字体

#### src/styles/animations.css

定义全局 keyframes：
- `cursorBlink` — 光标闪烁
- `fadeIn` / `fadeInUp` / `scaleIn` — 淡入动画
- `pulseGlow` — 脉冲光晕
- `breathe` — 呼吸效果
- `bounce` — 弹跳
- `shake` — 抖动（错误）
- Vue transition 类（`notch-expand-enter-active` 等）

---

## 六、数据流全景

### 6.1 完整数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                        主进程（Node.js）                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ claudeLogMonitor│───▶│ sessionManager  │───▶│ipcHandlers  │ │
│  │ 扫描日志文件     │    │ 定时推送(1.5s)  │    │ 发送IPC消息  │ │
│  └─────────────────┘    └─────────────────┘    └──────┬──────┘ │
└───────────────────────────────────────────────────────┼────────┘
                                                        │
                                                        │ webContents.send()
                                                        ▼
┌───────────────────────────────────────────────────────┼────────┐
│                     Preload 脚本                       │        │
│              contextBridge.exposeInMainWorld()        │        │
│                     window.electronAPI                 │        │
└───────────────────────────────────────────────────────┼────────┘
                                                        │
                                                        │ ipcRenderer.on()
                                                        ▼
┌───────────────────────────────────────────────────────┼────────┐
│                      渲染进程（Vue）                    │        │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │        │
│  │  App.vue    │───▶│notchStore   │───▶│ 各组件    │  │        │
│  │ 注册监听器   │    │ Pinia Store │    │ 响应更新  │  │        │
│  └─────────────┘    └─────────────┘    └───────────┘  │        │
│        ▲                                              │        │
│        │                                              │        │
│   useElectron.ts                                      │        │
│   onSessionsUpdate()                                  │        │
└───────────────────────────────────────────────────────┼────────┘
                                                        │
                                                        │ 用户交互
                                                        ▼
┌───────────────────────────────────────────────────────┼────────┐
│                    用户操作反馈                        │        │
│  CollapsedBar.click ──▶ toggleExpand() ──▶ IPC ──▶  │        │
│  SessionCard.click ──▶ focusTerminal(pid) ──▶ IPC ──▶│        │
│  TopBar.tabClick ──▶ setActiveTab() ──▶ 本地状态      │        │
└───────────────────────────────────────────────────────┴────────┘
```

### 6.2 状态变更时序示例

**场景：Claude 从 sleeping 变为 thinking**

```
时间 ────────────────────────────────────────────────────────▶

T+0ms    claudeLogMonitor.scanSessions()
         └─ 读取 session.json → status='busy'
         └─ 读取 .jsonl → lastEvent.type='assistant' + thinking
         └─ 判断为 'thinking'

T+50ms   sessionManager.pushSessions()
         └─ updateSessions(mainWindow, [..., {status:'thinking'}, ...])

T+60ms   mainWindow.webContents.send('sessions:update', sessions)

T+70ms   App.vue onSessionsUpdate(sessions)
         └─ store.updateSessions(sessions)

T+80ms   notchStore.detectStateChanges()
         └─ prev='sleeping', curr='thinking'
         └─ 触发 soundService.play('start')

T+90ms   Vue 响应式更新
         ├─ CollapsedBar: mascotStatus → 'processing'
         │   └─ CanvasRenderer 场景切换: sleep → work
         ├─ SessionCard: status → 'thinking'
         │   └─ SVG 图标切换: sleeping → thinking
         │   └─ TerminalOutput: 显示 thinking... 提示
         └─ AgentGroup: 重新排序（thinking 置顶）
```

---

## 七、文件依赖矩阵

### 7.1 谁依赖谁（导入关系）

| 文件 | 被谁导入 | 导入谁 |
|------|---------|--------|
| `electron/main.ts` | — | `notchWindow`, `trayManager`, `ipcHandlers`, `sessionManager` |
| `electron/preload.ts` | — | `src/types` |
| `electron/windows/notchWindow.ts` | `main.ts` | — |
| `electron/ipc/ipcHandlers.ts` | `main.ts` | `src/types`, `sessionManager` |
| `electron/tray/trayManager.ts` | `main.ts` | — |
| `electron/services/sessionManager.ts` | `main.ts`, `ipcHandlers` | `claudeLogMonitor`, `ipcHandlers` |
| `electron/services/claudeLogMonitor.ts` | `sessionManager` | `src/types` |
| `src/main.ts` | `index.html` | `vue`, `pinia`, `App.vue`, `variables.css`, `animations.css` |
| `src/App.vue` | `main.ts` | `notchStore`, `useElectron`, `CollapsedBar`, `ExpandedPanel`, `mockSessionService` |
| `src/stores/notchStore.ts` | `App.vue`, `CollapsedBar`, `ExpandedPanel`, `TopBar`, `SettingsPanel` | `pinia`, `types`, `soundService` |
| `src/composables/useElectron.ts` | `App.vue` | `types` |
| `src/composables/useWindowDrag.ts` | — | `types` |
| `src/composables/useEdgeDock.ts` | — | `types` |
| `src/components/CollapsedBar.vue` | `App.vue` | `notchStore`, `canvas-renderer` |
| `src/components/ExpandedPanel.vue` | `App.vue` | `notchStore`, `TopBar`, `AgentGroup` |
| `src/components/TopBar.vue` | `ExpandedPanel` | `notchStore`, `canvas-renderer` |
| `src/components/AgentGroup.vue` | `ExpandedPanel` | `types`, `SessionCard` |
| `src/components/SessionCard.vue` | `AgentGroup` | `types`, `TerminalOutput` |
| `src/components/TerminalOutput.vue` | `SessionCard` | `types` |
| `src/components/SettingsPanel.vue` | — | `notchStore` |
| `src/renderer/canvas/canvas-renderer.ts` | `CollapsedBar`, `TopBar` | `sprites`, `animations` |
| `src/renderer/canvas/sprites.ts` | `canvas-renderer` | — |
| `src/renderer/canvas/animations.ts` | `canvas-renderer` | — |
| `src/services/soundService.ts` | `notchStore` | — |
| `src/services/mockSessionService.ts` | `App.vue` | `types` |
| `src/types/index.ts` | **几乎所有文件** | — |

### 7.2 模块分层

```
┌────────────────────────────────────────┐
│  视图层（Vue Components）               │
│  CollapsedBar / ExpandedPanel / ...    │
├────────────────────────────────────────┤
│  状态层（Pinia Store）                  │
│  notchStore.ts                         │
├────────────────────────────────────────┤
│  服务层（Services）                     │
│  soundService / mockSessionService     │
├────────────────────────────────────────┤
│  渲染层（Canvas）                       │
│  canvas-renderer / sprites / animations│
├────────────────────────────────────────┤
│  桥接层（Composables + Preload）        │
│  useElectron / useWindowDrag / preload │
├────────────────────────────────────────┤
│  主进程层（Electron Main）              │
│  main / notchWindow / ipcHandlers / ...│
├────────────────────────────────────────┤
│  系统层（OS / FileSystem）              │
│  ~/.claude/sessions/ / ~/.claude/projects/
└────────────────────────────────────────┘
```

---

## 八、快速参考：常见问题

**Q: 新增一个 Vue 组件需要改哪些文件？**
1. 创建 `.vue` 文件
2. 在父组件中 `import` 并注册
3. 如果涉及数据，从 `notchStore` 读取或在 Store 新增 state/getter
4. 如果需要 IPC，通过 `useElectron.ts` 调用

**Q: 新增一个 IPC 通道需要改哪些文件？**
1. `src/types/index.ts` — 添加通道常量
2. `electron/preload.ts` — 暴露给渲染进程
3. `src/composables/useElectron.ts` — 封装调用函数
4. `electron/ipc/ipcHandlers.ts` — 注册主进程处理器

**Q: 章鱼动画的状态映射在哪里？**
- **CollapsedBar/TopBar 的 Canvas 章鱼：** `notchStore.mascotStatus`（`idle/processing/waitingApproval`）
- **SessionCard 的 SVG 章鱼：** `session.status`（6 种状态映射到 3 种图标）

**Q: 音效在哪里触发？**
`notchStore.ts` 的 `detectStateChanges()` 方法，对比前后状态决定播放哪种音效。
