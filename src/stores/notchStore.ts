import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, AgentGroupData, AgentType, AppSettings, DockPosition, SessionStatus } from '../types'
import { soundService } from '../services/soundService'

/**
 * Pinia Store - 灵动岛状态管理
 * 管理会话数据、UI状态、设置等
 */
export const useNotchStore = defineStore('notch', () => {
  // ==================== State ====================
  const isExpanded = ref(false)
  const activeTab = ref<'all' | 'sta' | 'cli'>('all')
  const sessions = ref<Session[]>([])
  const previousSessions = ref<Session[]>([])
  const dockPosition = ref<DockPosition>('none')
  const settings = ref<AppSettings>({
    autoStart: false,
    edgeDock: true,
    theme: 'dark',
    shortcut: 'Ctrl+Shift+V',
    opacity: 0.95,
    soundEnabled: true
  })
  const isSettingsOpen = ref(false)

  // 吉祥物状态（基于实际会话状态，供 CollapsedBar 使用）
  const mascotStatus = computed<'idle' | 'processing' | 'waitingApproval'>(() => {
    const activeSessions = sessions.value.filter((s) => s.status !== 'sleeping')
    if (activeSessions.length === 0) return 'idle'
    if (activeSessions.some((s) => s.status === 'waitingApproval')) return 'waitingApproval'
    return 'processing'
  })

  // ==================== Getters ====================

  /** 总会话数 */
  const sessionCount = computed(() => sessions.value.length)

  /** 工作中会话数 */
  const workingCount = computed(
    () => sessions.value.filter((s) => s.status !== 'sleeping').length
  )

  /** 按助手类型分组 */
  const groupedByAgent = computed<AgentGroupData[]>(() => {
    const groups: Record<string, AgentGroupData> = {}

    // 定义助手信息
    const agentInfo: Record<AgentType, { name: string }> = {
      claude: { name: 'Claude' },
      codex: { name: 'Codex' },
      gemini: { name: 'Gemini' }
    }

    // 按 agentType 分组
    for (const session of sessions.value) {
      if (!groups[session.agentType]) {
        groups[session.agentType] = {
          agentType: session.agentType,
          agentName: agentInfo[session.agentType].name,
          sessions: []
        }
      }
      groups[session.agentType].sessions.push(session)
    }

    // 按固定顺序返回，每组内部按状态排序：waitingApproval > thinking > tool_use > responding > working > sleeping
    const statusOrder: Record<SessionStatus, number> = {
      waitingApproval: 0,
      thinking: 1,
      tool_use: 2,
      responding: 3,
      working: 4,
      sleeping: 5,
    }
    for (const group of Object.values(groups)) {
      group.sessions.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
    }

    const order: AgentType[] = ['claude', 'codex', 'gemini']
    return order
      .map((type) => groups[type])
      .filter((g): g is AgentGroupData => g !== undefined && g.sessions.length > 0)
  })

  /** 过滤后的会话（根据标签页） */
  const filteredSessions = computed(() => {
    if (activeTab.value === 'all') {
      return sessions.value
    }
    // STA: 只显示 sleeping/thinking/waitingApproval 状态的（休息、思考和等待确认）
    if (activeTab.value === 'sta') {
      return sessions.value.filter((s) => s.status === 'sleeping' || s.status === 'thinking' || s.status === 'waitingApproval')
    }
    // CLI: 只显示 tool_use/responding/working 状态的（所有活跃工作）
    if (activeTab.value === 'cli') {
      return sessions.value.filter((s) => s.status === 'tool_use' || s.status === 'responding' || s.status === 'working')
    }
    return sessions.value
  })

  // ==================== Actions ====================

  /** 切换展开/收起 */
  function toggleExpand(): void {
    isExpanded.value = !isExpanded.value
    // 通知主进程
    window.electronAPI?.setExpanded?.(isExpanded.value)
  }

  /** 设置展开状态 */
  function setExpanded(expanded: boolean): void {
    isExpanded.value = expanded
  }

  /** 设置活跃标签 */
  function setActiveTab(tab: 'all' | 'sta' | 'cli'): void {
    activeTab.value = tab
  }

  /** 活跃状态集合 */
  const activeStatuses: SessionStatus[] = ['working', 'thinking', 'tool_use', 'responding']

  /**
   * 检测状态变化并触发对应音效
   */
  function detectStateChanges(prev: Session[], curr: Session[]): void {
    const prevMap = new Map(prev.map((s) => [s.id, s.status]))

    for (const session of curr) {
      const prevStatus = prevMap.get(session.id)
      if (!prevStatus || prevStatus === session.status) continue

      const wasSleeping = prevStatus === 'sleeping'
      const wasActive = activeStatuses.includes(prevStatus)
      const wasWaiting = prevStatus === 'waitingApproval'
      const isActive = activeStatuses.includes(session.status)
      const isWaiting = session.status === 'waitingApproval'
      const isSleeping = session.status === 'sleeping'

      if (wasSleeping && isActive) {
        // 从空闲变为活跃：AI 开始工作
        soundService.play('start')
      } else if (isWaiting) {
        // 变为等待确认
        soundService.play('approval')
      } else if ((wasActive || wasWaiting) && isSleeping) {
        // 从活跃或等待变为空闲：工作完成
        soundService.play('complete')
      }
    }
  }

  /** 更新会话数据 */
  function updateSessions(newSessions: Session[]): void {
    detectStateChanges(previousSessions.value, newSessions)
    previousSessions.value = newSessions
    sessions.value = newSessions
  }

  /** 添加会话 */
  function addSession(session: Session): void {
    sessions.value.push(session)
  }

  /** 更新单个会话 */
  function updateSession(id: string, updates: Partial<Session>): void {
    const index = sessions.value.findIndex((s) => s.id === id)
    if (index !== -1) {
      sessions.value[index] = { ...sessions.value[index], ...updates }
    }
  }

  /** 移除会话 */
  function removeSession(id: string): void {
    sessions.value = sessions.value.filter((s) => s.id !== id)
  }

  /** 贴边 */
  function dockToEdge(position: DockPosition): void {
    dockPosition.value = position
    window.electronAPI?.dockWindow?.(position)
  }

  /** 打开设置 */
  function openSettings(): void {
    isSettingsOpen.value = true
  }

  /** 关闭设置 */
  function closeSettings(): void {
    isSettingsOpen.value = false
  }

  /** 更新设置 */
  function updateSettings(newSettings: Partial<AppSettings>): void {
    settings.value = { ...settings.value, ...newSettings }
    // 同步音效开关状态
    soundService.setEnabled(settings.value.soundEnabled)
    // 同步到主进程
    window.electronAPI?.setSettings?.(settings.value)
  }

  /** 播放启动音效 */
  function playBootSound(): void {
    soundService.setEnabled(settings.value.soundEnabled)
    soundService.playBoot()
  }

  return {
    // State
    isExpanded,
    activeTab,
    sessions,
    previousSessions,
    dockPosition,
    settings,
    isSettingsOpen,
    mascotStatus,
    // Getters
    sessionCount,
    workingCount,
    groupedByAgent,
    filteredSessions,
    // Actions
    toggleExpand,
    setExpanded,
    setActiveTab,
    updateSessions,
    addSession,
    updateSession,
    removeSession,
    dockToEdge,
    openSettings,
    closeSettings,
    updateSettings,
    playBootSound
  }
})
