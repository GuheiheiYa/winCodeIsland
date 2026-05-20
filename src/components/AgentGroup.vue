<script setup lang="ts">
/**
 * AgentGroup - 助手分组组件
 * 显示助手图标、名称和会话列表
 * 参考设计：img_1.png 中的 Claude (3)、Codex (1)、Gemini (1) 分组
 */
import { computed } from 'vue'
import type { AgentGroupData, Session } from '../types'
import SessionCard from './SessionCard.vue'

const props = defineProps<{
  group: AgentGroupData
}>()

const emit = defineEmits<{
  'session-click': [session: Session]
}>()

/** 助手图标颜色配置 */
const agentStyles: Record<string, { icon: string; color: string; iconBg: string }> = {
  claude: {
    icon: '/resources/cli-icons/claude.png',
    color: '#fb923c',
    iconBg: 'rgba(251, 146, 60, 0.15)'
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
      <div class="agent-icon" :style="{ background: style.iconBg }">
        <img :src="style.icon" width="18" height="18" />
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
        @click="emit('session-click', $event)"
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
