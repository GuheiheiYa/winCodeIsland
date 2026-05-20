<script setup lang="ts">
/**
 * ExpandedPanel - 展开状态面板
 * 显示完整的会话列表，包含顶部栏和助手分组
 * 参考设计：img_1.png
 */
import { useNotchStore } from '../stores/notchStore'
import type { Session } from '../types'
import TopBar from './TopBar.vue'
import AgentGroup from './AgentGroup.vue'

const emit = defineEmits<{
  collapse: []
}>()

const store = useNotchStore()

function handleSessionClick(session: Session) {
  console.log('[ExpandedPanel] session clicked, pid=', session.pid, 'name=', session.projectName)
  if (session.pid) {
    window.electronAPI.focusTerminal(session.pid)
  } else {
    console.warn('[ExpandedPanel] session has no pid, cannot focus terminal:', session.projectName, session.id)
  }
}
</script>

<template>
  <div class="expanded-panel">
    <!-- 顶部栏 -->
    <TopBar @collapse="emit('collapse')" />

    <!-- 会话列表区域 -->
    <div class="panel-content">
      <!-- 按助手分组显示 -->
      <div
        v-for="(group, index) in store.groupedByAgent"
        :key="group.agentType"
        class="agent-section"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <AgentGroup :group="group" @session-click="handleSessionClick" />
      </div>

      <!-- 无会话提示 -->
      <div v-if="store.sessionCount === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4M6 17h12" />
          </svg>
        </div>
        <p class="empty-text">暂无活动会话</p>
        <p class="empty-subtext">启动终端会话后将在此处显示</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.expanded-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 560px;
  min-height: 280px;
  max-height: 370px;
  background: var(--bg-secondary);
  backdrop-filter: blur(40px) saturate(1.2);
  -webkit-backdrop-filter: blur(40px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-top: none; /* 顶部无边框 */
  border-radius: 0 0 24px 24px; /* 只底部圆角 */
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 顶部 micro-curve 弧线过渡（更大） */
.expanded-panel::before,
.expanded-panel::after {
  content: '';
  position: absolute;
  top: 0;
  width: 14px;
  height: 8px;
  background: transparent;
  z-index: 10;
}

.expanded-panel::before {
  left: -12px;
  border-radius: 0 6px 0 0;
  box-shadow: 2px -2px 0 rgba(255, 255, 255, 0.06);
}

.expanded-panel::after {
  right: -12px;
  border-radius: 6px 0 0 0;
  box-shadow: -2px -2px 0 rgba(255, 255, 255, 0.06);
}

/* 面板内容区域 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 12px 12px;
  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 4px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 助手分组区域 */
.agent-section {
  animation: fadeInUp 0.3s ease backwards;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 12px;
  color: var(--text-muted);
}

.empty-icon {
  opacity: 0.5;
}

.empty-text {
  font-size: var(--font-size-lg);
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-subtext {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}
</style>
