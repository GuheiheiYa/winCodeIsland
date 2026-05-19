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
│  │ 🐙 运行中... │  │  │ TopBar│  │ 标签 │  │设置 │      │  │
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
│  Tray (系统托盘)  │  SettingsPanel (设置模态框)            │
│  - 显示/隐藏      │  - 开机自启                             │
│  - 开机启动       │  - 贴边吸附                             │
│  - 退出           │  - 主题 / 快捷键 / 透明度               │
└─────────────────────────────────────────────────────────────┘
```

## 2. 核心模块

### 2.1 CollapsedBar - 收起状态

**文件**: `src/components/CollapsedBar.vue`

**职责**: 提供最小化状态的状态概览，作为用户与应用交互的入口。

**关键实现**:
- Canvas 2D 绘制像素章鱼吉祥物（26x22 CSS 像素，devicePixelRatio 适配）
- `CanvasRenderer` 引擎驱动三种动画场景：idle / processing / waitingApproval
- 轮询切换三种状态（每 3 秒循环），便于演示所有动画
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
- 尺寸 560px 宽，最大高度 85vh，带自定义滚动条
- 底部圆角 24px，无边框顶部，micro-curve 弧线过渡
- 按助手分组（Claude / Codex / Gemini）交错淡入动画
- 空状态友好提示

### 2.3 TopBar - 顶部栏

**文件**: `src/components/TopBar.vue`

**职责**: 展开面板的顶部控制区。

**功能**:
- ALL / STA / CLI 标签切换（过滤会话状态）
- 音量按钮（预留声音提示接口）
- 设置按钮（打开设置模态框）
- 关闭按钮（收起面板）

### 2.4 SessionCard - 会话卡片

**文件**: `src/components/SessionCard.vue`

**职责**: 单个会话的信息展示单元。

**展示内容**:
- 像素风项目图标（城堡/骷髅/星星等）
- 项目名称 + 会话编号
- 时间标签（1h、<1m、1m）
- 终端类型（Ghostty/iTerm2 + 彩色圆点）
- 最近终端输出（带颜色区分）
- 状态指示：sleeping（zzz图标）、thinking（光标闪烁）、working（绿色圆点）

### 2.5 AgentGroup - 助手分组

**文件**: `src/components/AgentGroup.vue`

**职责**: 按 AI 助手类型聚合会话卡片。

**分组规则**:
- Claude（橙色太阳图标）
- Codex（紫色图标）
- Gemini（紫色钻石图标）
- 按固定顺序渲染，空组自动隐藏

### 2.6 SettingsPanel - 设置面板

**文件**: `src/components/SettingsPanel.vue`

**职责**: 模态框形式的应用设置。

**配置项**:
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

## 4. 数据模型

### 4.1 Session（会话）

```typescript
interface Session {
  id: string              // 唯一标识
  projectName: string      // 项目名称
  sessionNumber?: string   // 编号（如 #8387）
  agentType: 'claude' | 'codex' | 'gemini'
  terminalType: 'ghostty' | 'iterm2'
  status: 'working' | 'sleeping' | 'thinking'
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
}
```

## 5. IPC 通信

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

## 6. 窗口系统

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
| 展开 | 560px | 680px（max 85vh） | 从收起位置向中心展开 |

### 6.3 贴边吸附
- 吸附阈值：40px
- 支持四边：top / bottom / left / right
- 拖拽结束时自动检测并吸附

## 7. 样式系统

### 7.1 CSS 变量

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
