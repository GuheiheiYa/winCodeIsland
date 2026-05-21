# 更新文档

## [未发布]

### 新增

- **终端窗口聚焦** - 点击展开面板中的会话卡片，自动聚焦到对应的终端窗口
  - `ExpandedPanel` 捕获 `session-click` 事件，调用 `window.electronAPI.focusTerminal(pid)`
  - `ipcHandlers.ts` 新增 `terminal:focus` IPC 处理器，通过 PID 查找并激活终端窗口
  - `SessionManager` 后台预热终端聚焦缓存，点击卡片时优先复用 `pid → hwnd/tabIndex` 解析结果
  - 支持 Windows Terminal（通过目标 PID 所属窗口 + `wt focus-tab` 切换标签页）和传统 CMD/PowerShell（通过 Win32 API 激活窗口）
  - 使用 `AttachThreadInput` 绕过 Windows 前台权限限制，800ms 后恢复 Electron 窗口置顶
- **扩展终端类型支持** - `TerminalType` 新增 `cmd`、`powershell`、`wt`（Windows Terminal）
  - `ClaudeLogMonitor` 根据 `process.platform` 自动判断终端类型（Windows → `cmd`，其他 → `ghostty`）
- **会话数据增强** - `Session` 接口新增 `pid?: number` 字段，用于终端窗口聚焦
  - `sessionNumber` 从 `undefined` 改为 `#${state.pid}`，显示进程编号

### 修复

- **修复 `ipcHandlers.ts` TypeScript 报错** - 将 `require('child_process')`、`require('fs')`、`require('path')`、`require('os')` 改为 ESModule `import` 语法，兼容 `tsconfig.node.json` 的 `module: "ESNext"` 配置
- **修复终端聚焦延迟与多窗口误定位** - 终端目标解析从点击时同步探测改为后台缓存，并按目标 PID 的 Windows Terminal 祖先窗口计算 tab 索引，不再默认使用第一个 Windows Terminal 窗口
- **修复 PowerShell resolver 变量冲突** - 避免使用 `$pid` / `$Pid` 这类会撞上 PowerShell 内置只读 `$PID` 的变量名
- **修复 Windows Terminal tab 未切换** - 激活目标 WT 窗口后优先发送 `Ctrl+Alt+1..9` 到当前前台窗口，避免外部 `wt -w 0 focus-tab` 命令落到错误窗口
- **增强 Windows Terminal 识别** - 当 `WindowsTerminal.exe` 不在目标 PID 直接祖先链时，改为先定位所属 `OpenConsole/conhost`，再反查包含该控制台宿主的 WT 窗口
- **兼容 Windows Terminal 默认终端模式** - 对 `claude.exe -> cmd.exe -> explorer.exe` 的进程链，按 shell 启动时间匹配 `OpenConsole.exe` 并计算 tab 索引
- **修复 sleeping 输出解析中的重复 `case`** - `assistant/message` 的嵌套 `tool_use` 检查合并到同一个分支，消除永远不可达的重复 case
- **修复主进程类型检查问题** - 补全 Claude `waiting` 状态类型，修正托盘图标类型，并将 `visibleOnAllWorkspaces` 从构造参数改为窗口创建后的 API 调用
- **修复 `tsconfig` 项目引用冲突** - 移除 `tsconfig.json` → `tsconfig.node.json` 的 `references`，解除 `src/types/index.ts` 被两个项目同时包含导致的类型检查冲突
  - `tsconfig.node.json` 直接包含 `"src/types/**/*.ts"`，并移除 `"composite": true`
- **修复 `waiting...` 颜色错误** - `TerminalOutput` 无输出时的默认提示，`waitingApproval` 状态从绿色改为橙色（`#fb923c`），`responding` 状态改为蓝色（`#60a5fa`），与 `SessionCard` 终端标签颜色体系一致
- **修复终端聚焦事件链断链** - `preload.ts` 补充暴露 `focusTerminal` 方法，`SessionCard` 添加 `@click` 事件发射，`AgentGroup` 透传 `session-click` 事件至 `ExpandedPanel`
- **修复最小化窗口无法弹出** - `ShowWindow(SW_RESTORE)` 后增加 150ms 延迟，等待 Windows 完成窗口恢复动画后再执行 `SetForegroundWindow`
- **修复 WT 标签页切换定位失败** - `wt` 命令增加 `-w 0` 窗口目标参数（指定当前 WT 窗口而非新建），并将 `focus-tab` 执行延迟 400ms（等待窗口完成焦点转移）
- **修复 WT 标签索引计算错误** - PowerShell 中 `$activeOcs` 过滤条件从"有子进程"改为"父进程是 WindowsTerminal"，排除系统其他终端的 conhost 干扰
- **修复 WT 标签切换快捷键错误** - `sendWindowsTerminalTabShortcut` 发送 `Ctrl+Alt+数字`，匹配用户自定义的 Windows Terminal 快捷键绑定
- **修复 WT 第10个标签页无法切换** - `sendWindowsTerminalTabShortcut` 支持 tabIndex=9（`Ctrl+Alt+0`）
- **修复 wt 命令回退参数** - `wt focus-tab` 的参数从 `--target` 修正为 `--tab`
- **修复 SendInput 后立即 detach 导致 WT 无法接收快捷键** - `focusWindowsTerminalTab` 中 SendInput 发送后延迟 200ms 再断开 `AttachThreadInput`，给 Windows Terminal 足够时间处理键盘事件
- **增强 WT 标签切换可靠性** - 同时执行 `wt focus-tab --tab <index>` 作为 SendInput 的可靠后备方案，确保标签页一定能切换
- **修复 PowerShell stdout 捕获失败导致解析结果丢失** - Electron `execFile` 无法可靠捕获 `ConvertTo-Json` 的 stdout 输出（PowerShell 非零退出码时 stdout 被清空），改为脚本将 JSON 结果写入临时文件，TypeScript 侧直接读取文件，彻底绕过 stdout/stderr 缓冲问题
- **修复 PowerShell 异常退出码** - `Get-Process -Name OpenConsole -ErrorAction SilentlyContinue` 在未匹配到进程时设置 `$?=$false`，导致脚本即使成功也返回退出码 1；末尾显式添加 `exit 0` 确保干净退出
- **优化终端聚焦速度** - 新增 5 分钟 TTL 缓存（`Map<pid → {hwnd, tabIndex, termType}`），同一会话二次点击跳过 PowerShell 冷启动；清理 PowerShell 脚本中 10+ 处调试输出减少 I/O 开销

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
