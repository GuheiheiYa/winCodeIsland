# 开发路线图

本文档汇总 Vibe Notch 所有已实现功能和待开发功能，是 `expanded-panel-roadmap.md` 的精简对照版。

---

## 版本历史

| 版本 | 日期 | 核心内容 |
|------|------|---------|
| v1.0.0 | 2025-05-19 | 灵动岛窗口、Canvas 吉祥物、展开面板、系统托盘、贴边吸附、模拟数据 |
| v1.0.1 | 2026-05-19 | TopBar 吉祥物、设置隐藏、面板固定高度 340px、手臂 CSS 动画 |
| v1.0.2 | 2026-05-19 | **真实 Claude 日志监控**（`~/.claude/sessions/*.json` + `*.jsonl`）、移除 node-pty |
| v1.0.3 | 2026-05-19 | 扩展为 5 状态（thinking/tool_use/responding/working/sleeping）|
| v1.0.4 | 2026-05-19 | 统一活跃状态展示（状态提示文字）、mascotStatus 计算属性、嵌套 tool_use 修复、waitingApproval、面板高度 370px |
| **v1.0.5** | 2026-05-19 | **音效系统**（8-bit WAV，状态变化触发，冷却控制，soundEnabled 设置）|

---

## 待开发功能

### P1 - 近期（下一个版本优先做）

| # | 功能 | 说明 | 涉及范围 |
|---|------|------|---------|
| 1 | **Windows 原生通知** | 状态变化时系统级通知（开始/完成/需确认），点击唤起面板 | 主进程 `ipcHandlers.ts` + 渲染进程 |
| 2 | **音量/静音 UI 开关** | TopBar 音量按钮目前只是占位，需接入 `soundEnabled` 状态 | `TopBar.vue`, `notchStore.ts` |
| 3 | **会话卡片右键菜单** | 复制输出 / 打开对应终端 / 结束会话 | `SessionCard.vue` |
| 4 | **输出操作** | 复制单行输出、长输出折叠展开 | `TerminalOutput.vue` |
| 5 | **链接可点击** | `link` 类型输出支持点击跳转浏览器 | `TerminalOutput.vue` |
| 6 | **实时滚动** | 展开面板内新输出自动滚动到底部，用户手动滚动后暂停 | `ExpandedPanel.vue` |
| 7 | **标签过滤调整** | 当前 STA 包含 thinking 不太合理，可重新划分或重命名标签 | `notchStore.ts` |

### P2 - 中期

| # | 功能 | 说明 | 涉及范围 |
|---|------|------|---------|
| 8 | **设置面板恢复** | 之前隐藏了，现在音效开关、透明度等需要配置入口 | `SettingsPanel.vue`, `TopBar.vue` |
| 9 | **多显示器支持** | 记住窗口所在显示器、分辨率/DPI 变化自适应、显示器插拔处理 | `notchWindow.ts` |
| 10 | **浅色主题** | 当前只有暗黑主题，需补充 light / auto 模式 | `variables.css`, 各组件 |
| 11 | **展开方向自适应** | 贴顶部时向下展开，贴底部时向上展开，贴左右时横向展开 | `notchWindow.ts`, `ExpandedPanel.vue` |
| 12 | **更多 AI 助手** | Codex / Gemini / Kimi / DeepSeek 的真实数据接入（目前只有 Claude）| `claudeLogMonitor.ts`（需抽象）|
| 13 | **会话历史持久化** | SQLite/JSON 存储历史会话，支持查看和搜索 | 新增服务层 |
| 14 | **吉祥物皮肤** | 切换颜色主题、动画速度调节、隐藏/显示开关 | `canvas-renderer.ts`, `SettingsPanel.vue` |
| 15 | **排序与搜索** | 按时间/状态/名称排序；按项目名称搜索过滤 | `notchStore.ts`, `TopBar.vue` |

### P3 - 远期

| # | 功能 | 说明 |
|---|------|------|
| 16 | **macOS 适配** | 窗口管理、托盘、路径处理 |
| 17 | **Linux 适配** | 同上 |
| 18 | **插件系统** | 允许第三方扩展新的 AI 助手数据源 |
| 19 | **Web 远程监控** | 通过浏览器查看会话状态，无需安装客户端 |

---

## 已知限制（当前版本）

- [x] ~~真实终端数据抓取~~ —— 已改为读取 Claude Code 本地日志，node-pty 方案已放弃
- [x] ~~声音提示~~ —— v1.0.5 已完成
- [ ] 多显示器支持未测试
- [ ] 浅色主题样式不完整
- [ ] macOS / Linux 平台未适配

---

## 文档索引

| 文档 | 职责 |
|------|------|
| `requirements.md` | FR-1 ~ FR-7 需求定义、NFR、用户故事 |
| `features.md` | 功能模块设计（CollapsedBar、Canvas、音效、会话监控、数据模型、IPC、样式） |
| `expanded-panel.md` | 展开面板专项（组件接口、视觉规范、性能指标） |
| `claude-session-format.md` | Claude Code 日志格式规范（sessions.json + jsonl 事件） |
| `changelog.md` | 版本发布记录（仅已发布版本） |
| `roadmap.md` | 待开发功能汇总（本文档） |
| `CLAUDE.md` | 代码架构、开发规范、数据流、文档更新规则 |
