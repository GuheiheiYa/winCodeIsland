# 展开面板设计文档

本文档记录 **ExpandedPanel** 及其子组件的架构设计、接口定义、视觉规范与性能指标。

> 展开面板的功能总览和交互说明见 [`features.md`](features.md) §2.2~2.6。
> 待开发功能见 [`roadmap.md`](roadmap.md)。

---

## 1. 组件架构

```
ExpandedPanel (展开面板容器)
├── TopBar (顶部控制栏)
│   ├── 标签过滤 (ALL / STA / CLI)
│   ├── 音量按钮
│   └── 关闭按钮 → 收起面板
├── AgentGroup - Claude
│   ├── 助手标题 (claude.png 图标 + 名称 + 数量)
│   └── SessionCard × N
│       ├── 项目图标 (像素风章鱼 SVG)
│       ├── 项目信息 (名称 + 编号)
│       ├── 元信息 (时间 + 终端类型)
│       └── 终端输出 (TerminalOutput)
└── EmptyState (空状态提示)
```

---

## 2. 组件接口定义

### 2.1 当前 Props / Emits

| 组件 | Props | Emits |
|------|-------|-------|
| ExpandedPanel | — | `collapse` |
| TopBar | — | `collapse` |
| AgentGroup | `group: AgentGroupData` | — |
| SessionCard | `session: Session` | — |
| TerminalOutput | `lines: OutputLine[], status: SessionStatus` | — |

### 2.2 未来扩展接口

```typescript
// SessionCard 新增 emits
interface SessionCardEmits {
  click: [sessionId: string]      // 点击跳转终端
  contextmenu: [sessionId: string, event: MouseEvent]
  remove: [sessionId: string]     // 结束会话
}

// TopBar 新增 props
interface TopBarProps {
  sortBy: 'time' | 'status' | 'name'
  searchQuery: string
}

// AgentGroup 新增 props
interface AgentGroupProps {
  group: AgentGroupData
  collapsed: boolean              // 可折叠分组
  sortBy: string
}
```

---

## 3. 视觉规范

### 3.1 尺寸

| 元素 | 宽度 | 高度 | 备注 |
|------|------|------|------|
| 展开面板 | 560px | 370px（固定） | 内容超出时内部滚动 |
| 顶部栏 | 100% | auto | padding 10px 16px 8px |
| 会话卡片 | 100% | auto | padding 7px 14px |
| 项目图标 | 44px | 44px | SVG 容器 |
| 设置面板 | 340px | auto | 居中模态框 |

### 3.2 颜色映射 (暗黑主题)

| 用途 | 色值 | 说明 |
|------|------|------|
| 运行中 | #4ade80 | working / thinking / tool_use |
| 生成回复 | #60a5fa | responding |
| 等待确认 | #fb923c | waitingApproval |
| 休眠中 | rgba(255,255,255,0.5) | sleeping |
| Claude | #fb923c | 橙色分组标识 |
| Codex | #8b5cf6 | 紫色分组标识（预留） |
| Gemini | #8b5cf6 | 紫色分组标识（预留） |
| 终端输出 | #ffffff | 主文字 |
| 终端前缀 $ | rgba(255,255,255,0.3) | 命令前缀 |
| 终端前缀 > | #4ade80 | 输出前缀 |
| 链接 | #60a5fa | 可点击链接 |

---

## 4. 性能指标

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 展开动画帧率 | 60fps | CSS transform |
| 列表滚动帧率 | 60fps | 虚拟滚动待评估 |
| IPC 延迟 | < 16ms | 当前无阻塞 |
| 大列表渲染 | < 100ms (50条) | 待测试 |
| 内存占用 | < 150MB | 待测试 |
