<script setup lang="ts">
/**
 * SessionCard - 会话卡片组件
 * 显示项目图标、名称、时间、终端类型、终端输出等
 * 参考设计：img_1.png 中的各个会话卡片
 */
import { computed } from 'vue'
import type { Session, SessionStatus } from '../types'
import TerminalOutput from './TerminalOutput.vue'

const props = defineProps<{
  session: Session
}>()

/** 状态标签配置 */
const statusConfig: Record<SessionStatus, { label: string; color: string; hasCursor: boolean; hasZzz: boolean }> = {
  working: { label: '', color: '#4ade80', hasCursor: false, hasZzz: false },
  sleeping: { label: '', color: '#60a5fa', hasCursor: false, hasZzz: true },
  thinking: { label: '', color: '#fb923c', hasCursor: true, hasZzz: false }
}

/** 根据项目名生成像素风图标 */
const projectIcon = computed(() => {
  const name = props.session.projectName.toLowerCase()
  // 为特定项目返回特定图标
  if (name.includes('vibe')) return 'castle'
  if (name.includes('api')) return 'skull'
  if (name.includes('web')) return 'star'
  if (name.includes('wxt')) return 'castle'
  // 默认图标类型
  const icons = ['castle', 'skull', 'star']
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return icons[hash % icons.length]
})

/** 项目名称显示颜色 */
const projectNameColor = computed(() => {
  if (props.session.status === 'thinking') {
    return 'var(--accent-green)'
  }
  return 'var(--text-primary)'
})

/** 终端类型圆点颜色 */
const terminalDotColor = computed(() => {
  switch (props.session.terminalType) {
    case 'ghostty':
      return props.session.agentType === 'codex' ? '#3b82f6' : '#4ade80'
    case 'iterm2':
      return '#f59e0b'
    default:
      return '#4ade80'
  }
})

/** 终端类型文字颜色 */
const terminalTextColor = computed(() => {
  switch (props.session.terminalType) {
    case 'ghostty':
      return props.session.agentType === 'codex' ? '#60a5fa' : '#4ade80'
    case 'iterm2':
      return '#fb923c'
    default:
      return '#4ade80'
  }
})
</script>

<template>
  <div
    class="session-card"
    :class="`status-${session.status}`"
  >
    <!-- 第一行：图标 + 项目名称/ID + 时间 + 终端类型 -->
    <div class="card-header">
      <!-- 左侧：项目图标 + 名称 -->
      <div class="project-info">
        <!-- 像素风项目图标 -->
        <div class="project-icon-wrapper">
          <!-- Sleeping 状态的 zzz -->
          <div v-if="session.status === 'sleeping'" class="sleep-indicator">
            <span class="zzz">z</span>
            <span class="zzz zzz-delay">z</span>
          </div>

          <!-- 像素风图标 -->
          <div class="pixel-icon" :class="projectIcon">
            <!-- Castle 图标 (vibe-notch) -->
            <template v-if="projectIcon === 'castle'">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <!-- 城堡主体 -->
                <rect x="6" y="10" width="20" height="14" rx="1" fill="#c4846a" />
                <!-- 左塔 -->
                <rect x="4" y="6" width="5" height="8" rx="0.5" fill="#d4846a" />
                <!-- 中央高塔 -->
                <rect x="12" y="4" width="8" height="10" rx="0.5" fill="#d4846a" />
                <!-- 右塔 -->
                <rect x="23" y="6" width="5" height="8" rx="0.5" fill="#d4846a" />
                <!-- 左门 -->
                <rect x="10" y="18" width="4" height="6" rx="1" fill="#5a3a2a" />
                <!-- 右门 -->
                <rect x="18" y="18" width="4" height="6" rx="1" fill="#5a3a2a" />
                <!-- 窗户 -->
                <rect x="14" y="14" width="4" height="3" rx="0.5" fill="#7ab8e8" />
                <!-- 城垛 -->
                <rect x="4" y="5" width="5" height="2" rx="0.5" fill="#b4745a" />
                <rect x="12" y="3" width="8" height="2" rx="0.5" fill="#b4745a" />
                <rect x="23" y="5" width="5" height="2" rx="0.5" fill="#b4745a" />
              </svg>
            </template>
            <!-- Skull 图标 (api) -->
            <template v-if="projectIcon === 'skull'">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <!-- 头骨主体 -->
                <rect x="7" y="5" width="18" height="18" rx="5" fill="#e0e0e0" />
                <!-- 左眼 -->
                <rect x="10" y="11" width="4" height="5" rx="1" fill="#3a3a3a" />
                <!-- 右眼 -->
                <rect x="18" y="11" width="4" height="5" rx="1" fill="#3a3a3a" />
                <!-- 鼻子 -->
                <rect x="14" y="17" width="4" height="2" rx="0.5" fill="#3a3a3a" />
                <!-- 牙齿 -->
                <rect x="12" y="23" width="2" height="3" rx="0.5" fill="#c0c0c0" />
                <rect x="15" y="23" width="2" height="3" rx="0.5" fill="#c0c0c0" />
                <rect x="18" y="23" width="2" height="3" rx="0.5" fill="#c0c0c0" />
              </svg>
            </template>
            <!-- Star/Diamond 图标 (web) -->
            <template v-if="projectIcon === 'star'">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <!-- 四角星/钻石形状 -->
                <path d="M16 3L20 12L29 16L20 20L16 29L12 20L3 16L12 12Z" fill="#8b5cf6" />
                <!-- 中心高光 -->
                <path d="M16 8L17.5 13.5L23 16L17.5 18.5L16 24L14.5 18.5L9 16L14.5 13.5Z" fill="#a78bfa" />
              </svg>
            </template>
          </div>
        </div>

        <!-- 项目名称和 ID -->
        <div class="project-name-section">
          <span class="project-name" :style="{ color: projectNameColor }">
            {{ session.projectName }}
          </span>
          <span v-if="session.sessionNumber" class="session-number">
            {{ session.sessionNumber }}
          </span>
        </div>
      </div>

      <!-- 右侧：时间标签 + 终端类型 -->
      <div class="meta-info">
        <!-- 时间标签 -->
        <span class="time-badge">{{ session.relativeTime }}</span>

        <!-- 终端类型标签 -->
        <div class="terminal-badge">
          <span class="terminal-dot" :style="{ background: terminalDotColor }" />
          <span class="terminal-name" :style="{ color: terminalTextColor }">{{ session.terminalType }}</span>
          <svg class="terminal-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 第二行：终端输出 -->
    <div class="terminal-output">
      <TerminalOutput :lines="session.lastOutput" :status="session.status" />
    </div>
  </div>
</template>

<style scoped>
.session-card {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  animation: fadeInUp 0.25s ease backwards;
}

.session-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-color-hover);
}

/* ===== 卡片头部 ===== */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

/* ===== 项目信息 ===== */
.project-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sleeping zzz 指示器 */
.sleep-indicator {
  position: absolute;
  top: -6px;
  right: -8px;
  display: flex;
  align-items: flex-end;
  gap: 0;
  pointer-events: none;
  z-index: 2;
}

.zzz {
  font-size: 8px;
  font-weight: 700;
  color: var(--accent-blue);
  opacity: 0.7;
  animation: breathe 2s ease infinite;
  line-height: 1;
}

.zzz-delay {
  animation-delay: 0.5s;
  font-size: 6px;
  margin-left: -1px;
}

/* 像素风图标 */
.pixel-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}

.pixel-icon.castle {
  filter: drop-shadow(0 0 2px rgba(212, 132, 106, 0.3));
}

.pixel-icon.skull {
  filter: drop-shadow(0 0 2px rgba(200, 200, 200, 0.2));
}

.pixel-icon.star {
  filter: drop-shadow(0 0 2px rgba(240, 192, 96, 0.3));
}

/* 项目名称区域 */
.project-name-section {
  display: flex;
  align-items: center;
  gap: 6px;
}

.project-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.session-number {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

/* ===== 元信息区域 ===== */
.meta-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 时间标签 */
.time-badge {
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* 终端类型标签 */
.terminal-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.terminal-badge:hover {
  background: var(--bg-hover);
  border-color: var(--border-color-hover);
}

.terminal-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.terminal-name {
  text-transform: capitalize;
}

.terminal-arrow {
  color: var(--text-muted);
  opacity: 0.6;
}

/* ===== 终端输出区域 ===== */
.terminal-output {
  margin-top: 4px;
  padding-left: 46px;
}

/* ===== 状态变体 ===== */
.status-thinking .project-name {
  color: var(--accent-green);
}

.status-sleeping .pixel-icon {
  opacity: 0.6;
  filter: grayscale(0.3);
}

.status-working .pixel-icon {
  animation: pulseGlow 2s ease infinite;
}
</style>
