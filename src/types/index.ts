/**
 * 终端输出行类型
 */
export interface OutputLine {
  type: 'command' | 'output' | 'thinking' | 'link' | 'prompt'
  content: string
  linkUrl?: string
}

/**
 * 会话状态
 */
export type SessionStatus = 'thinking' | 'tool_use' | 'responding' | 'working' | 'waitingApproval' | 'sleeping'

/**
 * 助手类型
 */
export type AgentType = 'claude' | 'codex' | 'gemini'

/**
 * 终端类型
 */
export type TerminalType = 'ghostty' | 'iterm2' | 'cmd' | 'powershell' | 'wt'

/**
 * 单个会话
 */
export interface Session {
  id: string
  projectName: string
  sessionNumber?: string
  pid?: number
  agentType: AgentType
  terminalType: TerminalType
  status: SessionStatus
  lastOutput: OutputLine[]
  timestamp: number
  relativeTime: string
}

/**
 * 助手分组
 */
export interface AgentGroupData {
  agentType: AgentType
  agentName: string
  sessions: Session[]
}

/**
 * 应用状态
 */
export interface AppState {
  isExpanded: boolean
  activeTab: 'all' | 'sta' | 'cli'
  sessions: Session[]
  dockPosition: 'top' | 'bottom' | 'left' | 'right' | 'none'
}

/**
 * 应用设置
 */
export interface AppSettings {
  autoStart: boolean
  edgeDock: boolean
  theme: 'dark' | 'light' | 'auto'
  shortcut: string
  opacity: number
  soundEnabled: boolean
}

/**
 * 贴边位置
 */
export type DockPosition = 'top' | 'bottom' | 'left' | 'right' | 'none'

/**
 * IPC 事件名称
 */
export const IPC_EVENTS = {
  WINDOW_TOGGLE_EXPAND: 'window:toggle-expand',
  WINDOW_SET_EXPANDED: 'window:set-expanded',
  WINDOW_DOCK: 'window:dock',
  WINDOW_SHOW: 'window:show',
  WINDOW_HIDE: 'window:hide',
  SESSIONS_UPDATE: 'sessions:update',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_CHANGED: 'settings:changed',
  APP_QUIT: 'app:quit',
  GET_SESSIONS: 'get:sessions',
  UPDATE_SESSIONS: 'update:sessions'
} as const

/**
 * Electron API 类型定义（通过 preload 暴露）
 */
export interface ElectronAPI {
  toggleExpand: () => void
  setExpanded: (expanded: boolean) => void
  dockWindow: (position: DockPosition) => void
  showWindow: () => void
  hideWindow: () => void
  quitApp: () => void
  onSessionsUpdate: (callback: (sessions: Session[]) => void) => () => void
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void
  getSettings: () => Promise<AppSettings>
  setSettings: (settings: AppSettings) => void
  onExpandChanged: (callback: (expanded: boolean) => void) => () => void
  setIgnoreMouseEvents: (ignore: boolean) => void
  focusTerminal: (pid: number) => void
  createSession: (projectName: string, cwd: string) => Promise<string>
  killSession: (id: string) => void
  platform: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
