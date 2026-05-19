import type { Session, OutputLine } from '../types'

/**
 * 模拟会话数据服务
 * 生成逼真的终端会话数据用于开发和演示
 */

// 项目名称池
const projectNames = [
  'vibe-notch', 'api-server', 'web-dashboard', 'mobile-app',
  'docs-site', 'cli-tools', 'ai-agent', 'chat-ui',
  'data-pipeline', 'auth-service', 'payment-gateway', 'notif-worker'
]

// 终端命令池
const commandTemplates = [
  { type: 'prompt' as const, content: '$ npm run dev' },
  { type: 'prompt' as const, content: '$ git commit -m "feat: add new feature"' },
  { type: 'prompt' as const, content: '$ docker compose up -d' },
  { type: 'prompt' as const, content: '$ pytest tests/' },
  { type: 'output' as const, content: '> Building project...' },
  { type: 'output' as const, content: '> Test passed: 42/42' },
  { type: 'output' as const, content: '> Deploying to production...' },
  { type: 'output' as const, content: '> Server running on port 3000' },
  { type: 'link' as const, content: 'https://github.com/user/repo/pull/123', linkUrl: 'https://github.com/user/repo/pull/123' },
  { type: 'thinking' as const, content: 'thinking_' }
]

// 终端输出模板（用于更逼真的会话内容）
const realisticOutputs: Record<string, OutputLine[]> = {
  'vibe-notch': [
    { type: 'prompt', content: '$ 搞定。两个 README 都加了图...' },
    { type: 'output', content: '> 有没有专业的截图工具啊' },
    { type: 'prompt', content: '$ 没装专业截图工具。推荐你装一个 ' },
    { type: 'link', content: 'Shottr', linkUrl: 'https://shottr.cc' },
    { type: 'prompt', content: '（免费、轻量），可以：' }
  ],
  'wxt': [
    { type: 'output', content: '> 哦' },
    { type: 'prompt', content: '$ Bro，有事随时说，我在这儿呢。' }
  ],
  'vibe-notch-demo': [
    { type: 'thinking', content: 'thinking_' }
  ],
  'api': [
    { type: 'output', content: '> Fix the login bug' },
    { type: 'thinking', content: 'thinking_' }
  ],
  'web': [],
  'notch-builder': [
    { type: 'output', content: '> 构建中...' },
    { type: 'prompt', content: '$ npm run build' },
    { type: 'output', content: '> Build success in 2.3s' }
  ],
  'dashboard': [
    { type: 'prompt', content: '$ done. ready for next task' }
  ],
  'docs': [
    { type: 'output', content: '> Write the API documentation' },
    { type: 'thinking', content: 'thinking_' }
  ]
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 生成相对时间字符串
 */
function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (hours >= 1) {
    return `${hours}h`
  } else if (minutes >= 1) {
    return `${minutes}m`
  } else {
    return '<1m'
  }
}

/**
 * 创建会话
 */
export function createSession(partial: Partial<Session> = {}): Session {
  const projectName = partial.projectName || projectNames[Math.floor(Math.random() * projectNames.length)]
  const agentType = partial.agentType || (['claude', 'codex', 'gemini'] as const)[Math.floor(Math.random() * 3)]
  const status = partial.status || (['working', 'sleeping', 'thinking'] as const)[Math.floor(Math.random() * 3)]
  const terminalType = partial.terminalType || (['ghostty', 'iterm2'] as const)[Math.floor(Math.random() * 2)]

  // 获取逼真的终端输出
  let lastOutput: OutputLine[] = partial.lastOutput || []
  if (lastOutput.length === 0) {
    const key = `${projectName}${partial.sessionNumber || ''}`
    if (realisticOutputs[key]) {
      lastOutput = realisticOutputs[key]
    } else if (realisticOutputs[projectName]) {
      lastOutput = realisticOutputs[projectName]
    } else {
      // 随机选择 2-4 条输出
      const count = 2 + Math.floor(Math.random() * 3)
      lastOutput = Array.from({ length: count }, () =>
        commandTemplates[Math.floor(Math.random() * commandTemplates.length)]
      )
    }
  }

  const timestamp = partial.timestamp || Date.now() - Math.floor(Math.random() * 7200000)

  return {
    id: partial.id || generateId(),
    projectName,
    sessionNumber: partial.sessionNumber || (Math.random() > 0.5 ? `#${Math.floor(1000 + Math.random() * 9000)}` : undefined),
    agentType,
    terminalType,
    status,
    lastOutput,
    timestamp,
    relativeTime: getRelativeTime(timestamp)
  }
}

/**
 * 生成初始会话列表（匹配设计图）
 */
export function generateInitialSessions(): Session[] {
  return [
    {
      id: 'session-1',
      projectName: 'vibe-notch',
      sessionNumber: '#8387',
      agentType: 'claude',
      terminalType: 'ghostty',
      status: 'sleeping',
      lastOutput: [
        { type: 'prompt', content: '$ 搞定。两个 README 都加了图...' },
        { type: 'output', content: '> 有没有专业的截图工具啊' },
        { type: 'prompt', content: '$ 没装专业截图工具。推荐你装一个 ' },
        { type: 'link', content: 'Shottr', linkUrl: 'https://shottr.cc' },
        { type: 'prompt', content: '（免费、轻量），可以：' }
      ],
      timestamp: Date.now() - 3600000,
      relativeTime: '1h'
    },
    {
      id: 'session-2',
      projectName: 'wxt',
      sessionNumber: undefined,
      agentType: 'claude',
      terminalType: 'iterm2',
      status: 'sleeping',
      lastOutput: [
        { type: 'output', content: '> 哦' },
        { type: 'prompt', content: '$ Bro，有事随时说，我在这儿呢。' }
      ],
      timestamp: Date.now() - 30000,
      relativeTime: '<1m'
    },
    {
      id: 'session-3',
      projectName: 'vibe-notch',
      sessionNumber: '#demo',
      agentType: 'claude',
      terminalType: 'ghostty',
      status: 'thinking',
      lastOutput: [
        { type: 'thinking', content: 'thinking_' }
      ],
      timestamp: Date.now() - 60000,
      relativeTime: '1m'
    },
    {
      id: 'session-4',
      projectName: 'api',
      sessionNumber: undefined,
      agentType: 'codex',
      terminalType: 'ghostty',
      status: 'thinking',
      lastOutput: [
        { type: 'output', content: '> Fix the login bug' },
        { type: 'thinking', content: 'thinking_' }
      ],
      timestamp: Date.now() - 60000,
      relativeTime: '1m'
    },
    {
      id: 'session-5',
      projectName: 'web',
      sessionNumber: undefined,
      agentType: 'gemini',
      terminalType: 'iterm2',
      status: 'sleeping',
      lastOutput: [],
      timestamp: Date.now() - 60000,
      relativeTime: '1m'
    },
    // working 状态
    {
      id: 'session-6',
      projectName: 'notch-builder',
      sessionNumber: undefined,
      agentType: 'claude',
      terminalType: 'iterm2',
      status: 'working',
      lastOutput: [
        { type: 'output', content: '> 构建中...' },
        { type: 'prompt', content: '$ npm run build' },
        { type: 'output', content: '> Build success in 2.3s' }
      ],
      timestamp: Date.now() - 120000,
      relativeTime: '2m'
    },
    // sleeping 状态
    {
      id: 'session-7',
      projectName: 'dashboard',
      sessionNumber: undefined,
      agentType: 'codex',
      terminalType: 'ghostty',
      status: 'sleeping',
      lastOutput: [
        { type: 'prompt', content: '$ done. ready for next task' }
      ],
      timestamp: Date.now() - 300000,
      relativeTime: '5m'
    },
    // thinking 状态
    {
      id: 'session-8',
      projectName: 'docs',
      sessionNumber: undefined,
      agentType: 'gemini',
      terminalType: 'iterm2',
      status: 'thinking',
      lastOutput: [
        { type: 'output', content: '> Write the API documentation' },
        { type: 'thinking', content: 'thinking_' }
      ],
      timestamp: Date.now() - 30000,
      relativeTime: '30s'
    }
  ]
}

/**
 * 模拟会话更新（thinking 光标闪烁等）
 */
export function simulateSessionUpdates(sessions: Session[]): Session[] {
  return sessions.map((session) => {
    // Thinking 状态的光标闪烁
    if (session.status === 'thinking') {
      return {
        ...session,
        lastOutput: session.lastOutput.map((line) =>
          line.type === 'thinking'
            ? {
                ...line,
                content: line.content === 'thinking_' ? 'thinking' : 'thinking_'
              }
            : line
        )
      }
    }
    return session
  })
}

/**
 * 启动模拟数据定时更新
 */
export function startMockUpdates(
  callback: (sessions: Session[]) => void,
  interval = 600
): () => void {
  let sessions = generateInitialSessions()

  // 立即发送初始数据
  callback(sessions)

  const timer = setInterval(() => {
    sessions = simulateSessionUpdates(sessions)
    callback(sessions)
  }, interval)

  // 返回清理函数
  return () => clearInterval(timer)
}
