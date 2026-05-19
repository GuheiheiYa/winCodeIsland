<script setup lang="ts">
/**
 * 根组件 - 灵动岛主容器
 * 管理收起/展开状态的切换和整体布局
 */
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useNotchStore } from './stores/notchStore'
import { onSessionsUpdate, onExpandChanged } from './composables/useElectron'
import { startMockUpdates } from './services/mockSessionService'
import type { Session } from './types'
import CollapsedBar from './components/CollapsedBar.vue'
import ExpandedPanel from './components/ExpandedPanel.vue'

const store = useNotchStore()
const containerRef = ref<HTMLDivElement | null>(null)
let unsubSessions: (() => void) | undefined
let unsubExpand: (() => void) | undefined
let cleanupMock: (() => void) | undefined

/**
 * 处理展开/收起切换
 */
function handleToggleExpand(): void {
  store.toggleExpand()
}

/**
 * 处理外部点击收起
 */
function handleClickOutside(event: MouseEvent): void {
  // 如果点击的是设置面板或设置按钮，不处理
  const target = event.target as HTMLElement
  if (target.closest('.settings-panel') || target.closest('.settings-btn')) {
    return
  }
  // 展开状态下点击外部收起
  if (store.isExpanded) {
    // 检查点击是否在容器内
    if (containerRef.value && !containerRef.value.contains(target)) {
      store.setExpanded(false)
    }
  }
}

/**
 * 初始化：加载静态数据 + 监听 IPC 事件和模拟数据
 */
function initializeApp(): void {
  // ========== 1. 监听主进程发来的会话更新（node-pty 真实数据）==========
  unsubSessions = onSessionsUpdate((sessions: Session[]) => {
    store.updateSessions(sessions)
  })

  // ========== 2. 监听展开状态变更（来自主进程）==========
  unsubExpand = onExpandChanged((expanded: boolean) => {
    store.setExpanded(expanded)
  })

  // ========== 3. 如果在浏览器环境（开发），启动定时更新（thinking 光标闪烁等）==========
  if (!window.electronAPI) {
    cleanupMock = startMockUpdates((sessions: Session[]) => {
      store.updateSessions(sessions)
    }, 600)
  }
}

/**
 * 鼠标穿透控制：透明区域点击穿透到下方窗口
 * Windows 下通过 setIgnoreMouseEvents 动态切换
 */
function setupMouseIgnore(): void {
  if (!window.electronAPI || window.electronAPI.platform !== 'win32') return

  const handleMouseMove = (e: MouseEvent): void => {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const isOverContent = !!el?.closest('.collapsed-bar, .expanded-panel')
    // 在内容区域时接收鼠标事件，在透明区域时穿透
    window.electronAPI?.setIgnoreMouseEvents?.(!isOverContent)
  }

  document.addEventListener('mousemove', handleMouseMove)

  // 返回清理函数
  return () => {
    document.removeEventListener('mousemove', handleMouseMove)
  }
}

let cleanupMouseIgnore: (() => void) | undefined

onMounted(() => {
  // 延迟初始化，确保所有组件就绪
  nextTick(() => {
    initializeApp()
  })

  // 监听全局点击事件（用于点击外部收起）
  document.addEventListener('mousedown', handleClickOutside)

  // 设置鼠标穿透（仅 Windows）
  cleanupMouseIgnore = setupMouseIgnore()
})

onUnmounted(() => {
  unsubSessions?.()
  unsubExpand?.()
  cleanupMock?.()
  document.removeEventListener('mousedown', handleClickOutside)
  cleanupMouseIgnore?.()
})
</script>

<template>
  <div
    ref="containerRef"
    class="app-container"
    :class="{
      'is-expanded': store.isExpanded,
      'is-collapsed': !store.isExpanded
    }"
  >
    <!-- 收起状态：Pill 形状小条 -->
    <CollapsedBar
      v-if="!store.isExpanded"
      @expand="handleToggleExpand"
    />

    <!-- 展开状态：完整面板 -->
    <ExpandedPanel
      v-else
      @collapse="handleToggleExpand"
    />

  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: transparent;
  /* 使用 CSS 变量 */
  font-family: var(--font-sans);
}

/* 收起状态 - 只底部圆角 + 居中 */
.is-collapsed {
  border-radius: 0 0 20px 20px; /* 只底部圆角，减小弧度 */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 展开状态 - 只底部圆角 + 纵向布局 */
.is-expanded {
  border-radius: 0 0 24px 24px; /* 只底部圆角 */
  display: flex;
  flex-direction: column;
}
</style>
