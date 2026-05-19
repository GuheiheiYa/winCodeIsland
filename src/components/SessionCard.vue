<script setup lang="ts">
/**
 * SessionCard - 会话卡片组件
 * 布局：左[动态章鱼] | 中[项目名+编号/下划线/终端输出] | 右[时间/终端类型]
 * 参考设计：notch-panel.png
 */
import { computed } from 'vue'
import type { Session } from '../types'
import TerminalOutput from './TerminalOutput.vue'

const props = defineProps<{
  session: Session
}>()

/** 根据会话状态返回像素章鱼图标类型 */
const statusIcon = computed(() => {
  switch (props.session.status) {
    case 'working':
      return 'working'
    case 'sleeping':
      return 'sleeping'
    case 'thinking':
      return 'thinking'
    default:
      return 'sleeping'
  }
})
</script>

<template>
  <div class="session-card" :class="`status-${session.status}`">
    <!-- 左列：动态章鱼图标 -->
    <div class="card-left">
      <div class="pixel-icon" :class="statusIcon">
        <!-- Sleeping 章鱼 - 精确复刻 Canvas idle 场景坐标 -->
        <template v-if="statusIcon === 'sleeping'">
          <svg class="octopus-body" width="44" height="44" viewBox="-2 3 20 14" fill="none">
            <!-- 阴影: rect(-1, 15, 17, 1) -->
            <rect x="-1" y="15" width="17" height="1" fill="rgba(0,0,0,0.3)" />
            <!-- 4条腿: rect(3, 8.5, 1, 1.5) 间距2 -->
            <rect x="3" y="8.5" width="1" height="1.5" fill="#DE886D" />
            <rect x="5" y="8.5" width="1" height="1.5" fill="#DE886D" />
            <rect x="9" y="8.5" width="1" height="1.5" fill="#DE886D" />
            <rect x="11" y="8.5" width="1" height="1.5" fill="#DE886D" />
            <!-- 躯体: rect(2, 10, 13, 5) -->
            <rect x="2" y="10" width="13" height="5" rx="0.3" fill="#DE886D" />
            <!-- 手臂（平放）: rect(-1, 13, 2, 2) / rect(14, 13, 2, 2) -->
            <rect x="-1" y="13" width="2" height="2" fill="#DE886D" />
            <rect x="14" y="13" width="2" height="2" fill="#DE886D" />
            <!-- 闭眼（黑色水平线）: rect(3, 12.2, 2.5, 1.0) -->
            <rect x="3" y="12.2" width="2.5" height="1" fill="#000000" />
            <rect x="9.5" y="12.2" width="2.5" height="1" fill="#000000" />
            <!-- 浮动 Zzz -->
            <text class="floating-z" x="14" y="7" fill="white" font-size="2.5" font-family="monospace" font-weight="bold">z</text>
          </svg>
        </template>
        <!-- Working 章鱼 - 精确复刻 Canvas work 场景坐标 -->
        <template v-if="statusIcon === 'working'">
          <svg class="octopus-body" width="44" height="44" viewBox="-2 3 20 14" fill="none">
            <!-- 阴影: rect(3, 15, 9, 1) -->
            <rect x="3" y="15" width="9" height="1" fill="rgba(0,0,0,0.3)" />
            <!-- 键盘底座: rect(-0.5, 11.8, 16, 3.5) -->
            <rect x="-0.5" y="11.8" width="16" height="3.5" rx="0.3" fill="#617080" />
            <!-- 键盘按键（6列x3行，代表性显示） -->
            <rect x="0.3" y="12.2" width="2" height="0.7" rx="0.1" fill="#99A9B8" />
            <rect x="2.8" y="12.2" width="2" height="0.7" rx="0.1" fill="#99A9B8" />
            <rect x="5.3" y="12.2" width="2" height="0.7" rx="0.1" fill="#99A9B8" />
            <rect x="7.8" y="12.2" width="2" height="0.7" rx="0.1" fill="#99A9B8" />
            <rect x="10.3" y="12.2" width="2" height="0.7" rx="0.1" fill="#99A9B8" />
            <rect x="12.8" y="12.2" width="2" height="0.7" rx="0.1" fill="#99A9B8" />
            <!-- 4条腿: rect(3, 13, 1, 2) -->
            <rect x="3" y="13" width="1" height="2" fill="#DE886D" />
            <rect x="5" y="13" width="1" height="2" fill="#DE886D" />
            <rect x="9" y="13" width="1" height="2" fill="#DE886D" />
            <rect x="11" y="13" width="1" height="2" fill="#DE886D" />
            <!-- 躯体: rect(2, 6, 11, 7) -->
            <rect x="2" y="6" width="11" height="7" rx="0.3" fill="#DE886D" />
            <!-- 手臂（打字动画） -->
            <rect class="arm-left" x="0" y="9" width="2" height="2" fill="#DE886D" />
            <rect class="arm-right" x="13" y="9" width="2" height="2" fill="#DE886D" />
            <!-- 眯眼: rect(4, 8.5, 1, 1) -->
            <rect x="4" y="8.5" width="1" height="1" fill="#000000" />
            <rect x="10" y="8.5" width="1" height="1" fill="#000000" />
          </svg>
        </template>
        <!-- Thinking/Alert 章鱼 - 精确复刻 Canvas alert 场景坐标 -->
        <template v-if="statusIcon === 'thinking'">
          <svg class="octopus-body" width="44" height="44" viewBox="-2 3 20 14" fill="none">
            <!-- 阴影: rect(3, 15, 9, 1) -->
            <rect x="3" y="15" width="9" height="1" fill="rgba(0,0,0,0.3)" />
            <!-- 4条腿: rect(3, 11, 1, 4) -->
            <rect x="3" y="11" width="1" height="4" fill="#DE886D" />
            <rect x="5" y="11" width="1" height="4" fill="#DE886D" />
            <rect x="9" y="11" width="1" height="4" fill="#DE886D" />
            <rect x="11" y="11" width="1" height="4" fill="#DE886D" />
            <!-- 躯体: rect(2, 6, 11, 7) -->
            <rect x="2" y="6" width="11" height="7" rx="0.3" fill="#DE886D" />
            <!-- 手臂（挥舞）pivot(2,10) 角度-40° / pivot(13,10) 角度155° -->
            <rect x="0" y="9" width="2" height="2" fill="#DE886D" transform="rotate(-40 1 10)" />
            <rect x="13" y="9" width="2" height="2" fill="#DE886D" transform="rotate(155 14 10)" />
            <!-- 大眼（惊吓）: rect(4, 7.5, 1, 2.6) -->
            <rect x="4" y="7.5" width="1" height="2.6" rx="0.2" fill="#000000" />
            <rect x="10" y="7.5" width="1" height="2.6" rx="0.2" fill="#000000" />
            <!-- 感叹号: rect(13, 4.5, 2, 3.5) -->
            <rect class="alert-bang" x="13" y="4.5" width="2" height="3.5" rx="0.2" fill="#FF3D00" />
            <rect class="alert-bang" x="13" y="8.5" width="2" height="1.5" rx="0.2" fill="#FF3D00" />
          </svg>
        </template>
      </div>
    </div>

    <!-- 中列：项目信息 + 终端输出 -->
    <div class="card-center">
      <!-- 项目名行（带下划线） -->
      <div class="project-header">
        <div class="project-title">
          <span class="project-name">{{ session.projectName }}</span>
          <span v-if="session.sessionNumber" class="session-number">{{ session.sessionNumber }}</span>
        </div>
        <div class="divider-line" />
      </div>

      <!-- 终端输出 -->
      <div class="terminal-output">
        <TerminalOutput :lines="session.lastOutput" :status="session.status" />
      </div>
    </div>

    <!-- 右列：时间 + 终端类型 -->
    <div class="card-right">
      <span class="time-badge">{{ session.relativeTime }}</span>
      <div class="terminal-badge" :class="`status-${session.status}`">
        <span class="terminal-name">{{ session.terminalType }}</span>
        <span class="terminal-arrow">→</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  animation: fadeInUp 0.25s ease backwards;
}

.session-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-color-hover);
}

/* ===== 左列：章鱼图标 ===== */
.card-left {
  flex-shrink: 0;
  width: 44px;
  padding-top: 2px;
}

.pixel-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sleeping: 呼吸缩放 + Zzz 浮动 */
.pixel-icon.sleeping .octopus-body {
  animation: octoBreathe 2.25s ease-in-out infinite;
  transform-origin: center bottom;
}

.pixel-icon.sleeping .floating-z {
  animation: zFloat 2.8s ease-in-out infinite;
}

@keyframes octoBreathe {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.03) translateY(-1px); }
}

@keyframes zFloat {
  0% { transform: translateY(0); opacity: 0.7; }
  50% { transform: translateY(-3px); opacity: 0.3; }
  100% { transform: translateY(-5px); opacity: 0; }
}

/* Working: 弹跳（0.35s 周期，与 Canvas 同步） */
.pixel-icon.working .octopus-body {
  animation: octoBounce 0.35s ease-in-out infinite;
  transform-origin: center bottom;
}

@keyframes octoBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

/* Working: 手臂打字动画 */
.pixel-icon.working .arm-left {
  transform-origin: 50% 50%;
  transform-box: fill-box;
  animation: armLeftType 0.15s ease-in-out infinite alternate;
}

.pixel-icon.working .arm-right {
  transform-origin: 50% 50%;
  transform-box: fill-box;
  animation: armRightType 0.12s ease-in-out infinite alternate;
}

@keyframes armLeftType {
  0% { transform: rotate(-55deg); }
  100% { transform: rotate(-10deg); }
}

@keyframes armRightType {
  0% { transform: rotate(10deg); }
  100% { transform: rotate(55deg); }
}

/* Thinking: 轻微弹跳 + 感叹号闪烁 */
.pixel-icon.thinking .octopus-body {
  animation: octoAlert 0.5s ease-in-out infinite;
  transform-origin: center bottom;
}

.pixel-icon.thinking .alert-bang {
  animation: bangPulse 0.5s ease-in-out infinite;
}

@keyframes octoAlert {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.02, 0.98); }
}

@keyframes bangPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 状态滤镜 */
.status-sleeping .pixel-icon {
  opacity: 0.85;
}

.status-working .pixel-icon {
  filter: drop-shadow(0 0 3px rgba(74, 222, 128, 0.25));
}

.status-thinking .pixel-icon {
  filter: drop-shadow(0 0 3px rgba(255, 61, 0, 0.3));
}

/* ===== 中列：项目信息 + 输出 ===== */
.card-center {
  flex: 1;
  min-width: 0;
}

.project-header {
  margin-bottom: 4px;
}

.project-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.project-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.status-working .project-name {
  color: var(--accent-green);
}

.status-thinking .project-name {
  color: var(--accent-orange);
}

.session-number {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

/* 下划线分隔 */
.divider-line {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

/* 终端输出 */
.terminal-output {
  margin-top: 4px;
}

/* ===== 右列：时间 + 终端类型 ===== */
.card-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 2px;
  margin-left: 8px;
}

/* 时间标签 */
.time-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
}

/* 终端类型标签 */
.terminal-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: capitalize;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 终端类型颜色按状态区分 */
.terminal-badge.status-working {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.terminal-badge.status-thinking {
  color: #fb923c;
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.terminal-badge.status-sleeping {
  color: rgba(255, 255, 255, 0.65);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.terminal-badge:hover {
  filter: brightness(1.2);
}

.terminal-arrow {
  opacity: 0.6;
  font-size: 10px;
}
</style>
