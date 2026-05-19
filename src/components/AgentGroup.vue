<script setup lang="ts">
/**
 * AgentGroup - 助手分组组件
 * 显示助手图标、名称和会话列表
 * 参考设计：img_1.png 中的 Claude (3)、Codex (1)、Gemini (1) 分组
 */
import { computed } from 'vue'
import type { AgentGroupData } from '../types'
import SessionCard from './SessionCard.vue'

const props = defineProps<{
  group: AgentGroupData
}>()

/** 助手图标颜色配置 */
const agentStyles: Record<string, { icon: string; color: string; iconBg: string }> = {
  claude: {
    // 太阳图标 - 橙色
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#fb923c"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="#fb923c" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    color: '#fb923c',
    iconBg: 'rgba(251, 146, 60, 0.15)'
  },
  codex: {
    // 紫色方形网格图标
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" fill="#8b5cf6" opacity="0.9"/><path d="M8 3v18M16 3v18M3 8h18M3 16h18" stroke="#a78bfa" stroke-width="1"/><circle cx="8" cy="8" r="1.5" fill="white"/><circle cx="16" cy="16" r="1.5" fill="white"/></svg>`,
    color: '#8b5cf6',
    iconBg: 'rgba(139, 92, 246, 0.15)'
  },
  gemini: {
    // 钻石/菱形图标 - 紫色
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L22 9L12 22L2 9Z" fill="#8b5cf6"/><path d="M12 2L22 9L12 22L2 9Z" fill="url(#gemini-grad)" opacity="0.8"/><defs><linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22"><stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs></svg>`,
    color: '#8b5cf6',
    iconBg: 'rgba(139, 92, 246, 0.15)'
  }
}

const style = computed(() => agentStyles[props.group.agentType] || agentStyles.claude)

/** 助手中文名称映射 */
const agentNameMap: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini'
}

const displayAgentName = computed(() => agentNameMap[props.group.agentType] || props.group.agentName)
</script>

<template>
  <div class="agent-group">
    <!-- 助手标题栏 -->
    <div class="agent-header">
      <div class="agent-icon" :style="{ background: style.iconBg, color: style.color }">
        <div v-html="style.icon" />
      </div>
      <span class="agent-name" :style="{ color: style.color }">
        {{ displayAgentName }}
      </span>
      <span class="agent-count">({{ group.sessions.length }})</span>
    </div>

    <!-- 会话列表 -->
    <div class="sessions-list">
      <SessionCard
        v-for="(session, index) in group.sessions"
        :key="session.id"
        :session="session"
        :style="{ animationDelay: `${index * 0.04}s` }"
      />
    </div>
  </div>
</template>

<style scoped>
.agent-group {
  padding: 6px 0;
}

/* ===== 助手标题栏 ===== */
.agent-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 4px;
  user-select: none;
}

.agent-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
}

.agent-name {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.02em;
}

.agent-count {
  font-size: var(--font-size-md);
  color: var(--text-muted);
  margin-left: 2px;
}

/* ===== 会话列表 ===== */
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 12px; /* 缩进效果 */
}
</style>
