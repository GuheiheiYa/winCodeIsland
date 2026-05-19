import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, AgentGroupData, AgentType, AppSettings, DockPosition } from '../types'

/**
 * Pinia Store - 灵动岛状态管理
 * 管理会话数据、UI状态、设置等
 */
export const useNotchStore = defineStore('notch', () => {
  // ==================== State ====================
  const isExpanded = ref(false)
  const activeTab = ref<'all' | 'sta' | 'cli'>('all')
  const sessions = ref<Session[]>([])
  const dockPosition = ref<DockPosition>('none')
  const settings = ref<AppSettings>({
    autoStart: false,
    edgeDock: true,
    theme: 'dark',
    shortcut: 'Ctrl+Shift+V',
    opacity: 0.95
  })
  const isSettingsOpen = ref(false)

  /** 吉祥物状态（全局轮训，供 CollapsedBar 和 TopBar 共享） */
  const mascotStatus = ref<'idle' | 'processing' | 'waitingApproval'>('idle')
  let mascotTimer: ReturnType<typeof setInterval> | null = null
  const STATUS_CYCLE: Array<'idle' | 'processing' | 'waitingApproval'> = [
    'idle',
    'processing',
    'waitingApproval',
  ]

  /** 启动吉祥物状态轮训（应用级，只应调用一次） */
  function startMascotCycle(): void {
    if (mascotTimer) return
    let idx = 0
    mascotStatus.value = STATUS_CYCLE[0]
    mascotTimer = setInterval(() => {
      idx = (idx + 1) % STATUS_CYCLE.length
      mascotStatus.value = STATUS_CYCLE[idx]
    }, 3000)
  }

  /** 停止吉祥物状态轮训 */
  function stopMascotCycle(): void {
    if (mascotTimer) {
      clearInterval(mascotTimer)
      mascotTimer = null
    }
  }

  // ==================== Getters ====================

  /** 总会话数 */
  const sessionCount = computed(() => sessions.value.length)

  /** 工作中会话数 */
  const workingCount = computed(
    () => sessions.value.filter((s) => s.status === 'working' || s.status === 'thinking').length
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

    // 按固定顺序返回
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
    // STA: 只显示 sleeping/thinking 状态的
    if (activeTab.value === 'sta') {
      return sessions.value.filter((s) => s.status === 'sleeping' || s.status === 'thinking')
    }
    // CLI: 只显示 working 状态的
    if (activeTab.value === 'cli') {
      return sessions.value.filter((s) => s.status === 'working')
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

  /** 更新会话数据 */
  function updateSessions(newSessions: Session[]): void {
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
    // 同步到主进程
    window.electronAPI?.setSettings?.(settings.value)
  }

  return {
    // State
    isExpanded,
    activeTab,
    sessions,
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
    startMascotCycle,
    stopMascotCycle
  }
})
