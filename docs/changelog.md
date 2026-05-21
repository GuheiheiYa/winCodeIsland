# 更新文档

## [未发布]

### 新增

- **终端窗口聚焦** - 点击展开面板中的会话卡片，自动聚焦到对应的终端窗口
  - `ExpandedPanel` 捕获 `session-click` 事件，调用 `window.electronAPI.focusTerminal(pid)`
  - `ipcHandlers.ts` 新增 `terminal:focus` IPC 处理器，通过 PID 查找并激活终端窗口
  - 纯 Win32 API 实现，无 PowerShell 脚本、无后台缓存、无延迟等待
  - 支持 Windows Terminal 和传统 CMD/PowerShell 窗口激活
- **扩展终端类型支持** - `TerminalType` 新增 `cmd`、`powershell`、`wt`（Windows Terminal）
  - `ClaudeLogMonitor` 根据 `process.platform` 自动判断终端类型（Windows → `cmd`，其他 → `ghostty`）
- **会话数据增强** - `Session` 接口新增 `pid?: number` 字段，用于终端窗口聚焦
  - `sessionNumber` 从 `undefined` 改为 `#${state.pid}`，显示进程编号

### 修复

- **修复 `ipcHandlers.ts` TypeScript 报错** - 将 `require('child_process')`、`require('fs')`、`require('path')`、`require('os')` 改为 ESModule `import` 语法，兼容 `tsconfig.node.json` 的 `module: "ESNext"` 配置
- **重构终端聚焦为极速响应** - 删除全部后台缓存、标签索引计算和延迟等待逻辑
  - 第一层：纯 Win32 API 枚举顶层可见窗口（`GetDesktopWindow` → `GetWindow(GW_CHILD)` → `GetWindow(GW_HWNDNEXT)`），匹配目标 PID 的窗口句柄并立即激活（~1-10ms）
  - 第二层：`AttachConsole(pid)` + `GetConsoleWindow()` 获取控制台窗口句柄并激活（~5-20ms）
  - 第三层：轻量 `wmic` 查询父进程链（最多 6 层），对祖先进程重复窗口枚举，异步兜底（~50-200ms）
  - 删除 `primeTerminalFocusCache`、`resolveTerminalTargets`、缓存 Map 及所有相关复杂逻辑
- **修复最小化窗口无法弹出** - `ShowWindow(SW_RESTORE)` 后立即执行 `SetForegroundWindow`，移除所有延迟等待
- **修复 sleeping 输出解析中的重复 `case`** - `assistant/message` 的嵌套 `tool_use` 检查合并到同一个分支，消除永远不可达的重复 case
- **修复主进程类型检查问题** - 补全 Claude `waiting` 状态类型，修正托盘图标类型，并将 `visibleOnAllWorkspaces` 从构造参数改为窗口创建后的 API 调用
- **修复 `tsconfig` 项目引用冲突** - 移除 `tsconfig.json` → `tsconfig.node.json` 的 `references`，解除 `src/types/index.ts` 被两个项目同时包含导致的类型检查冲突
  - `tsconfig.node.json` 直接包含 `"src/types/**/*.ts"`，并移除 `"composite": true`
- **修复 `waiting...` 颜色错误** - `TerminalOutput` 无输出时的默认提示，`waitingApproval` 状态从绿色改为橙色（`#fb923c`），`responding` 状态改为蓝色（`#60a5fa`），与 `SessionCard` 终端标签颜色体系一致
- **修复终端聚焦事件链断链** - `preload.ts` 补充暴露 `focusTerminal` 方法，`SessionCard` 添加 `@click` 事件发射，`AgentGroup` 透传 `session-click` 事件至 `ExpandedPanel`

## [v1.0.5] - 2026-05-19

### 新增

- **音效系统** - 8-bit 风格音效反馈，为会话状态变化提供声音提示
  - 音效文件：`public/resources/sounds/` 下 6 个 WAV 文件（boot/start/complete/approval/error/submit）
  - `SoundService`（`src/services/soundService.ts`）—— 预加载、冷却控制、开关管理
  - 状态转换触发逻辑：sleeping → active 播放 `start`、→ waitingApproval 播放 `approval`、active → sleeping 播放 `complete`
  - 启动时自动播放 `boot` 音效（仅一次）
  - 新增设置项 `soundEnabled`（`AppSettings`），默认开启
  - 各音效独立冷却时间（1~3 秒），防止重复触发

## [v1.0.4] - 2026-05-19

### 变更

- **活跃状态展示统一简化** - 所有非 sleeping 状态不再提取 text/thinking/工具参数，统一返回空数组由 TerminalOutput 展示状态提示文字（`working...` / `thinking...` / `using tool...` / `waiting...`），绿色脉冲动画
  - 移除 Markdown 渲染（`marked` 库不再使用）
  - `TerminalOutput` 高度从 120px 缩至 **24px**（仅展示 1 行）
  - `max-height` 由内容滚动改为 `overflow: hidden`
- **`mascotStatus` 改为计算属性** - 从 3 秒轮训切换改为基于实际会话状态实时计算：全部 sleeping → `idle`，有 waitingApproval → `waitingApproval`，其他活跃 → `processing`
  - 移除 `startMascotCycle()` / `stopMascotCycle()` 轮训逻辑
  - `CollapsedBar` 与 `TopBar` 吉祥物状态与实际会话完全同步
- **嵌套 tool_use 识别修复** - Claude Code API 的 `tool_use` 嵌套在 `assistant`/`message` 的 `content` 数组中，`findLastEventOfType` 同时检查顶层 type 和嵌套 content，确保 waitingApproval / working 状态正确识别工具调用
- **展开面板高度调整** - 从 340px 增至 **370px**
- **状态扩展为 6 状态** - 新增 `waitingApproval`（`state.status === 'waiting'` 时映射）

### 修复

- 修复 `tool_use` 嵌套在 `assistant` content 中导致 `findLastEventOfType` 返回 null 的问题
- 修复 `waitingApproval` 状态错误展示旧 text 内容而非等待确认命令的问题
- 修复 `mascotStatus` 轮训与实际会话状态不同步导致的动画错乱

## [v1.0.3] - 2026-05-19

### 新增

- **扩展 SessionStatus 状态系统** - 从 3 状态扩展为 5 状态，更精确反映 Claude Code 行为
  - `thinking` —— Claude 正在思考（assistant/message 包含 thinking 内容）
  - `tool_use` —— Claude 正在执行工具（最后事件为 `tool_use`）
  - `responding` —— Claude 正在生成回复（assistant/message 无 thinking）
  - `working` —— 用户刚输入或其他 busy fallback（最后事件为 `user`）
  - `sleeping` —— Claude 空闲（`idle`）
  - 状态判断改为"最后事件类型优先"策略，更准确
  - `responding` 状态终端标签显示为蓝色（`#60a5fa`），与 `tool_use`/`working` 的绿色区分
- **Markdown 渲染支持** - `TerminalOutput` 组件支持 Markdown 渲染
  - 安装 `marked` 库（v18.0.4）用于 Markdown 解析
  - `output` 类型行自动检测 Markdown 语法（标题、列表、代码块、表格、粗体、斜体、链接、引用等）
  - 匹配时通过 `marked.parse()` 渲染为 HTML，使用 `v-html` 注入
  - 新增暗色主题 Markdown 样式（`:deep()` 穿透 scoped CSS）
  - 非 Markdown 输出保持原有纯文本样式不变
  - `thinking` / `command` / `prompt` / `link` 类型保持原有渲染逻辑

## [v1.0.2] - 2026-05-19

### 变更

- **真实 Claude 会话监控** - 放弃 node-pty 方案，改为读取 Claude Code 本地日志文件
  - 扫描 `~/.claude/sessions/*.json` 获取活跃会话状态（busy / idle）
  - 读取 `~/.claude/projects/<hash>/<sessionId>.jsonl` 获取实时输出和 thinking 状态
  - 状态映射：busy + 最近 thinking → `thinking`，busy + 其他 → `working`，idle → `sleeping`
  - 支持嵌套 thinking 检测（assistant message content 数组中的 thinking 块）
  - 自动提取用户输入（prompt）、AI 输出（output）、工具调用（command）
- **列表展示优化** - 会话按 `thinking → working → sleeping` 排序；空闲会话只显示最后一行输出
- **移除模拟数据** - 完全移除 `generateInitialSessions` 和 `startMockDataService`
- **移除 node-pty** - 删除 `PtySession` 类和相关 IPC handler

## [v1.0.1] - 2026-05-19

### 变更

- **TopBar 吉祥物 Logo** - 左侧静态 SVG 图标替换为 Canvas 像素章鱼吉祥物（28x24px），与 CollapsedBar 共享同一 `mascotStatus` 状态，三种场景同步轮训切换
- **吉祥物状态全局化** - 将 `mascotStatus` 及轮训逻辑从 `CollapsedBar.vue` 提取至 `notchStore`，新增 `startMascotCycle()` / `stopMascotCycle()`，收起/展开状态均同步显示
- **背景色加深** - `--bg-panel`、`--bg-primary`、`--bg-secondary` 统一加深为 `rgba(10, 10, 18, 0.98)` / `#080810`，减少透明感
- **设置功能移除** - 暂时隐藏 `SettingsPanel` 组件渲染，移除 TopBar 设置按钮及相关 IPC 调用
- **展开面板高度调整** - 从 680px 改为 **340px 固定高度**，内容在面板内部滚动，消除下方透明死区
- **SessionCard 章鱼手臂动画** - working 状态图标新增 CSS keyframes 打字手臂旋转动画（左右臂交替 0.15s / 0.12s）
- **TopBar Logo 放大** - 品牌图标从 16x16px 放大至 **32x32px**

### 修复

- 修复 `settings:get` IPC 调用无处理器导致的运行时错误

---

## [v1.0.0] - 2025-05-19

### 新增

- **灵动岛主窗口** - 无边框置顶 Pill 形悬浮窗口，支持拖拽和贴边吸附
- **收起状态（CollapsedBar）** - Canvas 2D 绘制像素风小章鱼吉祥物
  - 三种动画场景：idle（睡觉呼吸）、processing（弹跳打字）、waitingApproval（跳跃告警）
  - 状态文字联动（运行中绿色 / 请确认红色 / 休息中白色）
  - 科技像素风字体样式（等宽字体 + 发光 text-shadow）
  - 动态省略号动画（'' → '.' → '..' → '...'）
- **展开面板（ExpandedPanel）** - 560px 宽完整面板，毛玻璃效果
- **会话管理** - 支持 Claude / Codex / Gemini 三种助手分组显示
- **会话卡片（SessionCard）** - 像素风图标、终端输出高亮、状态指示
- **顶部栏（TopBar）** - ALL/STA/CLI 标签过滤、音量/设置/关闭按钮
- **系统托盘（Tray）** - 右键菜单支持显示/隐藏、开机启动、退出
- **设置面板（SettingsPanel）** - 开机自启、贴边吸附、主题、快捷键、透明度配置
- **Canvas 渲染引擎** - 完整的 2D 像素角色渲染系统（含 Spring 物理动画）
- **模拟数据服务** - 开发模式下定时发送模拟会话数据，thinking 光标闪烁
- **贴边吸附** - 拖拽结束后自动吸附到屏幕四边，阈值 40px
- **CSS 动画系统** - 统一的 keyframes 和 Vue Transition 类

### 技术栈

- Electron 28 + Vue 3.4 + TypeScript 5.3
- Pinia 状态管理
- Vite 5 + electron-vite 构建
- Canvas 2D 自定义渲染引擎
