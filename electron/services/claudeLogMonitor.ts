import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'
import type { OutputLine, Session, SessionStatus } from '../../src/types'

/**
 * Claude Code 本地日志监控器
 *
 * 通过读取 ~/.claude/sessions/*.json 状态文件和
 * ~/.claude/projects/<hash>/<sessionId>.jsonl 日志文件，
 * 获取用户当前所有活跃的 Claude Code 会话状态。
 */
export class ClaudeLogMonitor {
  private claudeDir: string
  private sessionsDir: string
  private projectsDir: string
  private lastJsonlSizes = new Map<string, number>()
  private cachedTailLines = new Map<string, string[]>()

  constructor() {
    const home = process.platform === 'win32'
      ? process.env.USERPROFILE
      : process.env.HOME
    if (!home) throw new Error('Cannot determine home directory')

    this.claudeDir = join(home, '.claude')
    this.sessionsDir = join(this.claudeDir, 'sessions')
    this.projectsDir = join(this.claudeDir, 'projects')
  }

  /**
   * 扫描并返回当前所有 Claude 会话
   */
  scanSessions(): Session[] {
    if (!existsSync(this.sessionsDir)) return []

    const sessionFiles = readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'))
    const sessions: Session[] = []

    for (const file of sessionFiles) {
      const session = this.readSession(file)
      if (session) sessions.push(session)
    }

    return sessions
  }

  /**
   * 读取单个会话文件并解析为 Session
   */
  private readSession(filename: string): Session | null {
    const path = join(this.sessionsDir, filename)
    let data: string
    try {
      data = readFileSync(path, 'utf-8')
    } catch {
      return null
    }

    let state: SessionState
    try {
      state = JSON.parse(data)
    } catch {
      return null
    }

    // 只处理交互式 CLI 会话
    if (state.kind !== 'interactive' || state.entrypoint !== 'cli') {
      return null
    }
    if (!this.isProcessAlive(state.pid)) {
      return null
    }

    const projectName = this.extractProjectName(state.cwd)
    const { status, lastOutput } = this.analyzeSession(state)

    const diff = Date.now() - state.updatedAt
    const minutes = Math.floor(diff / 60000)
    const relativeTime = minutes >= 1 ? `${minutes}m` : '<1m'

    return {
      id: state.sessionId,
      projectName,
      sessionNumber: `#${state.pid}`,
      pid: state.pid,
      agentType: 'claude',
      terminalType: process.platform === 'win32' ? 'cmd' : 'ghostty',
      status,
      lastOutput,
      timestamp: state.updatedAt,
      relativeTime,
    }
  }

  /**
   * 分析会话状态：读取 JSONL 日志判断 thinking/working/sleeping
   *
   * lastOutput 提取策略（按状态区分，更聚焦）：
   * - thinking: 优先展示 thinking 内容 + 用户问题（最多 3 行）
   * - working:  展示工具调用或 AI 输出（最多 2 行）
   * - sleeping: 只展示最后一行（任意类型）
   */
  private analyzeSession(state: SessionState): { status: SessionStatus; lastOutput: OutputLine[] } {
    const jsonlPath = this.findJsonlFile(state)
    const events = jsonlPath ? this.readJsonlTail(jsonlPath, 50) : []

    // 判断状态：先看最后的事件类型，再结合 thinking 事件
    let status: SessionStatus
    let lastThinkingEvt: JsonlEvent | null = null

    if (state.status === 'idle') {
      status = 'sleeping'
    } else if (state.status === 'waiting') {
      status = 'waitingApproval'
    } else {
      const lastEvent = events.length > 0 ? events[events.length - 1] : null
      const lastEventType = lastEvent?.type

      if (lastEventType === 'user') {
        // 用户刚输入，Claude 正在处理 → working
        status = 'working'
      } else if (lastEventType === 'tool_use') {
        // 正在执行工具 → tool_use
        status = 'tool_use'
      } else if (lastEventType === 'assistant' || lastEventType === 'message') {
        // Claude 正在生成回复：检查是否包含 thinking
        if (hasThinkingContent(lastEvent?.message?.content)) {
          status = 'thinking'
          lastThinkingEvt = lastEvent
        } else {
          status = 'responding'
        }
      } else {
        // 其他情况：fallback 到 thinking 检测（用于嵌套 thinking 在较早事件的情况）
        lastThinkingEvt = this.findLastThinkingEvent(events)
        if (lastThinkingEvt) {
          const ts = typeof lastThinkingEvt.timestamp === 'string'
            ? new Date(lastThinkingEvt.timestamp).getTime()
            : (lastThinkingEvt.timestamp || Date.now())
          const timeSinceThinking = Date.now() - ts
          status = timeSinceThinking < 10000 ? 'thinking' : 'working'
        } else {
          status = 'working'
        }
      }
    }

    // 按状态提取输出内容
    const outputLines = this.buildOutputLines(events, status, lastThinkingEvt)

    return { status, lastOutput: outputLines }
  }

  /**
   * 根据状态构建 lastOutput
   */
  private buildOutputLines(
    events: JsonlEvent[],
    status: SessionStatus,
    lastThinkingEvt: JsonlEvent | null
  ): OutputLine[] {
    const lines: OutputLine[] = []

    // 活跃状态统一返回空，由 TerminalOutput 展示状态提示文字（working... / thinking... 等）
    if (status !== 'sleeping') {
      return lines
    }

    // Sleeping：只展示最后一行有意义的输出
    for (let i = events.length - 1; i >= 0 && lines.length < 1; i--) {
      const line = this.eventToOutputLine(events[i])
      if (line) {
        lines.push(line)
        break
      }
    }

    return lines
  }

  /**
   * 查找指定 name 的最近 tool_use（支持嵌套）
   */
  private findLastToolUseByName(events: JsonlEvent[], toolName: string): JsonlEvent | null {
    for (let i = events.length - 1; i >= 0; i--) {
      const evt = events[i]
      if (evt.type === 'tool_use' && evt.name === toolName) return evt
      if (evt.type === 'assistant' || evt.type === 'message') {
        const content = evt.message?.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item?.type === 'tool_use' && item.name === toolName) {
              return { type: 'tool_use', name: item.name, input: item.input, ...item } as JsonlEvent
            }
          }
        }
      }
    }
    return null
  }

  /**
   * 查找指定类型的最近事件（支持顶层 type 和嵌套在 assistant/message content 中的 tool_use）
   */
  private findLastEventOfType(events: JsonlEvent[], type: string): JsonlEvent | null {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === type) return events[i]
      // tool_use 可能嵌套在 assistant/message 的 content 数组中
      if (type === 'tool_use' && (events[i].type === 'assistant' || events[i].type === 'message')) {
        const content = events[i].message?.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item?.type === 'tool_use') {
              // 返回一个合成的 event，包含 tool_use 的字段
              return {
                type: 'tool_use',
                name: item.name,
                input: item.input,
                ...item,
              } as JsonlEvent
            }
          }
        }
      }
    }
    return null
  }

  /**
   * 查找指定类型之一（数组）的最近事件
   */
  private findLastEventOfTypes(events: JsonlEvent[], types: string[]): JsonlEvent | null {
    for (let i = events.length - 1; i >= 0; i--) {
      if (types.includes(events[i].type)) return events[i]
    }
    return null
  }

  /**
   * 查找指定 tool_use 之后的 tool_result
   */
  private findToolResultAfter(events: JsonlEvent[], toolUse: JsonlEvent): JsonlEvent | null {
    const idx = events.indexOf(toolUse)
    if (idx === -1) return null
    for (let i = idx + 1; i < events.length; i++) {
      if (events[i].type === 'tool_result') return events[i]
    }
    return null
  }

  /**
   * 查找指定会话的 JSONL 文件路径
   */
  private findJsonlFile(state: SessionState): string | null {
    // sessions 文件中的 cwd 是项目路径
    // projects 目录名是对路径的某种编码，如 D--project-aiProject-winCodeIsland
    // 先尝试直接匹配：遍历 projects 目录找到包含对应 sessionId 的

    if (!existsSync(this.projectsDir)) return null

    const projectDirs = readdirSync(this.projectsDir)
    for (const dir of projectDirs) {
      const projectPath = join(this.projectsDir, dir)
      const stat = statSync(projectPath)
      if (!stat.isDirectory()) continue

      const jsonlFile = join(projectPath, `${state.sessionId}.jsonl`)
      if (existsSync(jsonlFile)) {
        return jsonlFile
      }
    }

    return null
  }

  /**
   * 读取 JSONL 文件的最后 N 行（带缓存，只读取新增内容）
   */
  private readJsonlTail(filePath: string, lineCount: number): JsonlEvent[] {
    let content: string
    try {
      const stats = statSync(filePath)
      const currentSize = stats.size
      const lastSize = this.lastJsonlSizes.get(filePath) ?? 0

      if (currentSize === lastSize && this.cachedTailLines.has(filePath)) {
        // 文件没有变化，返回缓存
        return this.cachedTailLines.get(filePath)!.map((l) => this.safeParseJson(l)).filter(Boolean) as JsonlEvent[]
      }

      // 文件有变化，重新读取末尾内容
      // 简单实现：读取整个文件（对于大文件可以用更高效的方式）
      content = readFileSync(filePath, 'utf-8')
      this.lastJsonlSizes.set(filePath, currentSize)
    } catch {
      return []
    }

    const lines = content.split('\n').filter((l) => l.trim())
    this.cachedTailLines.set(filePath, lines.slice(-lineCount * 2))

    return lines
      .slice(-lineCount)
      .map((l) => this.safeParseJson(l))
      .filter(Boolean) as JsonlEvent[]
  }

  private safeParseJson(line: string): JsonlEvent | null {
    try {
      return JSON.parse(line) as JsonlEvent
    } catch {
      return null
    }
  }

  /**
   * 将 JSONL 事件转换为 OutputLine
   */
  private eventToOutputLine(evt: JsonlEvent): OutputLine | null {
    switch (evt.type) {
      case 'user': {
        const text = extractTextContent(evt.message?.content)
        if (text) return { type: 'prompt', content: truncate(text, 120) }
        return null
      }
      case 'thinking': {
        const text = evt.thinking ?? extractThinkingFromContent(evt.message?.content)
        if (text) return { type: 'thinking', content: truncate(text, 120) }
        return null
      }
      case 'message':
      case 'assistant': {
        const content = evt.message?.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item?.type === 'tool_use') {
              return { type: 'command', content: `[Tool] ${item.name ?? 'unknown'}` }
            }
          }
        }
        const text = extractTextContent(content)
        if (text) return { type: 'output', content: truncate(text, 120) }
        return null
      }
      case 'text':
        if (evt.text) {
          return { type: 'output', content: truncate(evt.text, 120) }
        }
        return null
      case 'tool_use':
        return { type: 'command', content: `[Tool] ${evt.name ?? 'unknown'}` }
      case 'tool_result': {
        const text = evt.content ? truncate(String(evt.content), 120) : null
        if (text) return { type: 'output', content: text }
        return null
      }
      case 'queue-operation':
        return { type: 'thinking', content: 'Processing...' }
      default:
        return null
    }
  }

  /**
   * 查找最近的 thinking 事件（包括独立事件和嵌套在 assistant 中的）
   */
  private findLastThinkingEvent(events: JsonlEvent[]): JsonlEvent | null {
    for (let i = events.length - 1; i >= 0; i--) {
      const evt = events[i]
      // 独立的 thinking 事件
      if (evt.type === 'thinking') return evt
      // 嵌套在 assistant/message 中的 thinking
      if ((evt.type === 'assistant' || evt.type === 'message') && hasThinkingContent(evt.message?.content)) {
        return evt
      }
    }
    return null
  }

  /**
   * 格式化 tool_use 为等待确认友好的字符串（只展示核心内容，不加工具前缀）
   */
  private formatToolRequest(toolEvt: JsonlEvent): string {
    const name = (toolEvt.name as string) ?? 'Tool'
    const input = toolEvt.input as Record<string, unknown> | undefined

    if (name === 'Bash' && input?.command && typeof input.command === 'string') {
      return truncate(input.command, 100)
    }
    if ((name === 'Read' || name === 'Edit' || name === 'Write') && input?.file_path && typeof input.file_path === 'string') {
      return truncate(input.file_path, 100)
    }
    if ((name === 'GrepSearch' || name === 'WebSearch') && input?.query && typeof input.query === 'string') {
      return truncate(input.query, 100)
    }
    if (name === 'WebFetch' && input?.url && typeof input.url === 'string') {
      return truncate(input.url, 100)
    }

    // 通用 fallback：取 input 的第一个字符串值
    if (input) {
      for (const key of Object.keys(input)) {
        const val = input[key]
        if (typeof val === 'string' && val.length > 0) {
          return truncate(val, 100)
        }
      }
    }

    return `${name} (...)`
  }

  /**
   * 从完整路径提取项目名称
   */
  private extractProjectName(cwd: string): string {
    if (!cwd) return 'Unknown'
    const parts = cwd.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || parts[parts.length - 2] || 'Unknown'
  }

  private isProcessAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false

    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
}

// ---- 辅助类型 ----

interface SessionState {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  status: 'busy' | 'idle' | 'waiting'
  updatedAt: number
  kind: string
  entrypoint: string
  version: string
}

interface JsonlEvent {
  type: string
  timestamp?: number | string
  message?: { content?: string; role?: string }
  thinking?: string
  text?: string
  name?: string
  input?: unknown
  content?: unknown
  [key: string]: unknown
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

/** 提取文本的最后一句（结论），fallback 到 truncate */
function extractLastSentence(str: string, max: number): string {
  if (str.length <= max) return str
  // 找最后一个句子结束标点后的文本
  const sentenceEnd = /[.!?。！？]\s+([^\n]+)$/
  const match = str.match(sentenceEnd)
  if (match && match[1] && match[1].length >= 10) {
    const last = match[1].trim()
    if (last.length <= max) return last
    return truncate(last, max)
  }
  // 没有标点或太短，从后往前找空格截断
  const cut = str.slice(-max)
  const spaceIdx = cut.indexOf(' ')
  if (spaceIdx > 0) return '…' + cut.slice(spaceIdx + 1)
  return truncate(str, max)
}

/** 提取文本的第一句（核心回答），fallback 到 truncate */
function extractFirstSentence(str: string, max: number): string {
  if (str.length <= max) return str
  // 找第一句结束
  const firstSentence = str.split(/[.!?。！？]/)[0]?.trim() ?? str
  if (firstSentence.length >= 5 && firstSentence.length <= max) {
    return firstSentence
  }
  return truncate(str, max)
}

/** 从 message.content（可能是字符串或数组）中提取纯文本 */
function extractTextContent(content: unknown): string | null {
  if (!content) return null
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    // content 是数组，找第一个 text 类型的元素
    for (const item of content) {
      if (item?.type === 'text' && item.text) return item.text
    }
  }
  return null
}

/** 从 message.content 数组中提取 thinking 文本 */
function extractThinkingFromContent(content: unknown): string | null {
  if (!Array.isArray(content)) return null
  for (const item of content) {
    if (item?.type === 'thinking' && item.thinking) return item.thinking
  }
  return null
}

/** 检查 content 数组中是否包含 thinking 类型 */
function hasThinkingContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some((item) => item?.type === 'thinking')
}
