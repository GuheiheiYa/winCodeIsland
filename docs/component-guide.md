# Vibe Notch — 组件关系与数据流指南

> 以 `App.vue` 为入口，逐层拆解每个 Vue 组件包含什么、数据从哪里来、绑定了哪些 TS 文件。

---

## 一、组件树总览

```
App.vue (根组件)
├── CollapsedBar.vue          ← 收起状态（Pill 小条）
│   └── Canvas 像素章鱼        ← canvas-renderer.ts + sprites.ts + animations.ts
│
└── ExpandedPanel.vue         ← 展开状态（完整面板）
    ├── TopBar.vue            ← 顶部栏：标签 + 按钮
    │   └── Canvas 像素章鱼    ← canvas-renderer.ts
    │
    ├── AgentGroup.vue × N    ← 助手分组（Claude / Codex / Gemini）
    │   └── SessionCard.vue   ← 单个会话卡片
    │       └── TerminalOutput.vue  ← 终端输出行
    │
    └── SettingsPanel.vue     ← 设置弹窗（未在展开面板内直接引用，通过条件渲染）
```

---

## 二、App.vue — 根组件

**文件位置：** `src/App.vue`

**作用：** 整个应用的入口壳，控制「收起 / 展开」两种状态的切换。

**包含的子组件：**

| 条件 | 渲染的组件 | 说明 |
|------|-----------|------|
| `!store.isExpanded` | `CollapsedBar.vue` | 顶部 Pill 小条，显示章鱼 + 状态文字 |
| `store.isExpanded` | `ExpandedPanel.vue` | 完整面板，显示会话列表 |

**数据来源：**
- `useNotchStore` (Pinia Store) — 读取/写入 `isExpanded` 状态
- `useElectron.ts` — 注册 IPC 监听器，接收主进程推送的数据

**绑定的 TS 文件：**

| TS 文件 | 作用 | 绑定方式 |
|--------|------|---------|
| `stores/notchStore.ts` | 全局状态管理 | `const store = useNotchStore()` |
| `composables/useElectron.ts` | IPC 监听封装 | `onSessionsUpdate()`, `onExpandChanged()`, `getSettings()` |
| `services/mockSessionService.ts` | 浏览器环境模拟数据 | `startMockUpdates()`（仅在非 Electron 环境） |
| `composables/useWindowDrag.ts` | 窗口拖拽（未直接在 App.vue 导入，由 CollapsedBar 使用） | — |

**初始化流程（`initializeApp`）：**

```
1. getSettings() → 加载主进程保存的设置 → store.updateSettings()
2. onSessionsUpdate(callback) → 主进程推送 Session[] → store.updateSessions()
3. onExpandChanged(callback) → 主进程推送展开状态 → store.setExpanded()
4. onSettingsChanged(callback) → 主进程推送设置变更 → store.updateSettings()
5. 播放启动音效 playBootSound()
6. setupMouseIgnore() → Windows 下透明区域鼠标穿透
```

---

## 三、CollapsedBar.vue — 收起状态

**文件位置：** `src/components/CollapsedBar.vue`

**作用：** 顶部 Pill 形状小条，左侧显示动态像素章鱼，中间显示状态文字，右侧显示会话数量。

**UI 结构：**

```
┌─────────────────────────────────────┐
│ 🐙  运行中...        3 个会话        │
└─────────────────────────────────────┘
 ↑    ↑                ↑
 │    │                └── 右侧：session-count（总会话数）
 │    └── 中间：status-text（idle/运行中/请确认）+ 动态省略号
 └── 左侧：Canvas 像素章鱼（26×22，devicePixelRatio 适配）
```

**数据来源：**
- `store.mascotStatus` → 计算属性，映射为 `idle / processing / waitingApproval`
- `store.sessionCount` → 总会话数
- `statusMeta` → 根据 mascotStatus 返回颜色、文字、发光效果

**绑定的 TS 文件：**

| TS 文件 | 作用 | 绑定方式 |
|--------|------|---------|
| `stores/notchStore.ts` | 读取 mascotStatus、sessionCount | `const store = useNotchStore()` |
| `renderer/canvas/canvas-renderer.ts` | Canvas 2D 渲染引擎 | `new CanvasRenderer(canvas)` |
| `renderer/canvas/sprites.ts` | 颜色、坐标映射、手臂路径 | 被 canvas-renderer.ts 内部 import |
| `renderer/canvas/animations.ts` | Spring 物理、关键帧插值 | 被 canvas-renderer.ts 内部 import |

**点击行为：**
- `@click` → `emit('expand')` → App.vue `handleToggleExpand()` → `store.toggleExpand()` → 通知主进程 → 窗口展开

---

## 四、ExpandedPanel.vue — 展开状态

**文件位置：** `src/components/ExpandedPanel.vue`

**作用：** 展开后的完整面板，560px 宽，显示所有会话分组列表。

**包含的子组件：**

| 组件 | 来源 | 说明 |
|------|------|------|
| `TopBar.vue` | 内部 import | 顶部栏：标签切换 + 按钮 |
| `AgentGroup.vue` | 内部 import | 助手分组，按 `agentType` 渲染多个 |

**数据来源：**
- `store.groupedByAgent` → 按助手类型分组的会话数组
- `store.sessionCount` → 判断空状态

**绑定的 TS 文件：**

| TS 文件 | 作用 | 绑定方式 |
|--------|------|---------|
| `stores/notchStore.ts` | 读取 groupedByAgent、sessionCount | `const store = useNotchStore()` |

**点击行为：**
- 点击会话卡片 → `handleSessionClick(session)` → `window.electronAPI.focusTerminal(pid)` → 主进程激活对应终端窗口

---

## 五、TopBar.vue — 顶部栏

**文件位置：** `src/components/TopBar.vue`

**作用：** 展开面板的顶部区域，左侧是带章鱼图标的标签切换（ALL/STA/CLI），右侧是音量和关闭按钮。

**UI 结构：**

```
┌─────────────────────────────────────────────┐
│ 🐙  [ALL] [STA] [CLI]          🔊  ⏻       │
└─────────────────────────────────────────────┘
      ↑                           ↑
      │                           └── 右侧：音量 + 关闭按钮
      └── 左侧：Canvas 章鱼图标 + 标签页
```

**数据来源：**
- `store.activeTab` → 当前选中的标签（all / sta / cli）
- `store.mascotStatus` → Canvas 章鱼状态

**绑定的 TS 文件：**

| TS 文件 | 作用 | 绑定方式 |
|--------|------|---------|
| `stores/notchStore.ts` | 读取 activeTab、mascotStatus | `const store = useNotchStore()` |
| `renderer/canvas/canvas-renderer.ts` | 小尺寸 Canvas 章鱼渲染 | `new CanvasRenderer(canvas)` |

**标签过滤逻辑（在 notchStore.ts 中）：**

| 标签 | 显示的状态 |
|------|-----------|
| ALL | 全部会话 |
| STA | sleeping / thinking / waitingApproval（静态/思考/等待） |
| CLI | tool_use / responding / working（活跃工作） |

---

## 六、AgentGroup.vue — 助手分组

**文件位置：** `src/components/AgentGroup.vue`

**作用：** 按助手类型（Claude / Codex / Gemini）分组显示会话列表。

**UI 结构：**

```
┌─ Claude (3) ─────────────────────────┐
│  🖼️  Claude                           │
│                                       │
│  ┌─ SessionCard ──────────────────┐   │
│  │  🐙  project-name  #123   →    │   │
│  └─────────────────────────────────┘   │
│  ┌─ SessionCard ──────────────────┐   │
│  │  🐙  another-project  #124  →  │   │
│  └─────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**数据来源：**
- `props.group` → `AgentGroupData` 类型，包含 `agentType`、`agentName`、`sessions[]`

**包含的子组件：**

| 组件 | 说明 |
|------|------|
| `SessionCard.vue` | 遍历 `group.sessions` 渲染多个 |

**绑定的 TS 文件：** 无直接 TS 绑定，纯展示组件。

---

## 七、SessionCard.vue — 会话卡片

**文件位置：** `src/components/SessionCard.vue`

**作用：** 单个会话的展示卡片，左中右三栏布局。

**UI 结构：**

```
┌──────────────────────────────────────────────────────┐
│ ┌──┐  ┌──────────────────────────┐  ┌─────────────┐ │
│ │🐙│  │ project-name    #123     │  │ 5m    →     │ │
│ │  │  │ ──────────────────────── │  │  iterm2     │ │
│ │  │  │ $ npm run dev            │  │             │ │
│ └──┘  └──────────────────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────┘
  ↑          ↑                              ↑
  │          │                              └── 右列：relativeTime + terminalType
  │          └── 中列：projectName + sessionNumber / 分隔线 / 终端输出
  └── 左列：SVG 像素章鱼（三种形态：sleeping/working/thinking）
```

**数据来源：**
- `props.session` → `Session` 类型，包含完整会话信息

**状态图标映射：**

| 会话状态 | 图标类型 | 说明 |
|---------|---------|------|
| sleeping | `sleeping` | 闭眼章鱼 + Zzz 浮动动画 |
| working | `working` | 打字章鱼 + 键盘 + 手臂动画 |
| thinking / waitingApproval | `thinking` | 惊吓章鱼 + 感叹号 + 红色光晕 |
| tool_use / responding | `working` | 同上 working |

**包含的子组件：**

| 组件 | 条件 | 说明 |
|------|------|------|
| `TerminalOutput.vue` | `!isIdle`（非 sleeping 状态） | 终端输出行 |

**绑定的 TS 文件：** 无直接 TS 绑定，纯展示组件。

---

## 八、TerminalOutput.vue — 终端输出

**文件位置：** `src/components/TerminalOutput.vue`

**作用：** 显示会话的最后输出内容，支持多种行类型（prompt/output/thinking/command/link）。

**数据来源：**
- `props.lines` → `OutputLine[]` 类型
- `props.status` → 当前会话状态，用于显示状态提示文字

**行类型映射：**

| type | 显示前缀 | 颜色 |
|------|---------|------|
| `prompt` | `$` | 白色 |
| `output` | `>` | 绿色 |
| `thinking` | `💭` | 橙色 |
| `command` | `[Tool]` | 蓝色 |
| `link` | `🔗` | 可点击链接 |

---

## 九、数据流全景图

```
主进程（Electron）
    │
    │ 每 1.5s
    ▼
┌─────────────────────────┐
│ sessionManager.ts       │
│  └─ claudeLogMonitor.ts │  ← 读取 ~/.claude/sessions/*.json + *.jsonl
└─────────────────────────┘
    │
    │ send('sessions:update', sessions)
    ▼
┌─────────────────────────┐
│ preload.ts              │  ← contextBridge 中转
└─────────────────────────┘
    │
    │ ipcRenderer.on('sessions:update')
    ▼
┌─────────────────────────┐
│ App.vue                 │
│  └─ onSessionsUpdate()  │
└─────────────────────────┘
    │
    │ store.updateSessions(sessions)
    ▼
┌─────────────────────────┐
│ notchStore.ts (Pinia)   │
│  ├─ sessions[]          │
│  ├─ mascotStatus        │ ← computed：idle / processing / waitingApproval
│  ├─ groupedByAgent      │ ← computed：按 agentType 分组
│  ├─ filteredSessions    │ ← computed：按 activeTab 过滤
│  └─ detectStateChanges()│ ← 状态变化时触发音效
└─────────────────────────┘
    │
    │ Vue 响应式驱动
    ├──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼
CollapsedBar  TopBar    AgentGroup  SessionCard
    │          │           │          │
    ▼          ▼           ▼          ▼
Canvas章鱼   Canvas章鱼  遍历渲染   SVG章鱼 +
            (小尺寸)     SessionCard  TerminalOutput
```

---

## 十、TS 文件与 Vue 文件绑定关系总表

### 10.1 状态管理

| TS 文件 | 被哪些 Vue 文件导入 | 作用 |
|--------|-------------------|------|
| `stores/notchStore.ts` | **所有 Vue 组件** | Pinia Store：会话数据、UI 状态、设置、计算属性 |

### 10.2 IPC 通信

| TS 文件 | 被哪些 Vue 文件导入 | 作用 |
|--------|-------------------|------|
| `composables/useElectron.ts` | `App.vue` | 封装 `window.electronAPI`，提供类型安全的主进程通信 |

### 10.3 Canvas 渲染

| TS 文件 | 被哪些 Vue 文件导入 | 作用 |
|--------|-------------------|------|
| `renderer/canvas/canvas-renderer.ts` | `CollapsedBar.vue`, `TopBar.vue` | Canvas 2D 渲染引擎，rAF 循环 + 场景路由 |
| `renderer/canvas/sprites.ts` | 仅被 `canvas-renderer.ts` 内部使用 | 颜色定义、坐标映射、手臂路径计算 |
| `renderer/canvas/animations.ts` | 仅被 `canvas-renderer.ts` 内部使用 | Spring 物理、关键帧插值函数 |

### 10.4 服务

| TS 文件 | 被哪些 Vue 文件导入 | 作用 |
|--------|-------------------|------|
| `services/soundService.ts` | `notchStore.ts`（间接） | 音效播放（Web Audio API），状态变化时触发 |
| `services/mockSessionService.ts` | `App.vue` | 浏览器环境模拟数据，生成假 Session[] |

### 10.5 类型定义

| TS 文件 | 被哪些文件导入 | 作用 |
|--------|---------------|------|
| `types/index.ts` | **几乎所有文件** | TypeScript 类型定义：Session、SessionStatus、AgentType、AppSettings、ElectronAPI 等 |

---

## 十一、音效触发链路

```
主进程推送 sessions:update
    │
    ▼
notchStore.updateSessions(newSessions)
    │
    ▼
detectStateChanges(prev, curr)
    │
    ├── sleeping → active (working/thinking/tool_use/responding)
    │       └── soundService.play('start')
    │
    ├── any → waitingApproval
    │       └── soundService.play('approval')
    │
    └── active/waitingApproval → sleeping
            └── soundService.play('complete')
    │
    ▼
Web Audio API 播放音效
```

---

## 十二、开发模式 vs 生产模式数据流差异

### 生产模式（Electron）

```
~/.claude/sessions/*.json ──┐
                            ├─ claudeLogMonitor.ts ── sessionManager.ts ── IPC ── App.vue
~/.claude/projects/*/*.jsonl ┘
```

### 开发模式（浏览器）

```
mockSessionService.ts ── 定时生成假数据 ── 直接回调给 App.vue ── notchStore
```

切换逻辑在 `App.vue initializeApp()` 中：

```typescript
if (!window.electronAPI) {
  // 浏览器环境，启动模拟数据
  cleanupMock = startMockUpdates(callback, 600)
}
```
