<script setup lang="ts">
/**
 * TerminalOutput - 终端输出行组件
 * 显示带颜色的终端输出：$灰色, >绿色, 链接蓝色, thinking光标闪烁
 * 支持 Markdown 渲染（output 类型且内容包含 Markdown 语法时）
 */
import { computed } from 'vue'
import type { OutputLine, SessionStatus } from '../types'

const props = defineProps<{
  lines: OutputLine[]
  status: SessionStatus
}>()

/**
 * 获取行类型的样式类
 */
function getLineClass(line: OutputLine): string {
  switch (line.type) {
    case 'prompt':
      return 'line-prompt'
    case 'output':
      return 'line-output'
    case 'thinking':
      return 'line-thinking'
    case 'link':
      return 'line-link'
    case 'command':
      return 'line-command'
    default:
      return 'line-output'
  }
}

/**
 * 获取行前缀符号
 */
function getLinePrefix(line: OutputLine): string {
  switch (line.type) {
    case 'prompt':
      return '$ '
    case 'output':
      return '> '
    case 'command':
      return '$ '
    default:
      return ''
  }
}

/**
 * 根据状态返回默认提示文字
 */
const statusLabel = computed(() => {
  switch (props.status) {
    case 'thinking':
      return 'thinking...'
    case 'tool_use':
      return 'using tool...'
    case 'responding':
      return 'responding...'
    case 'working':
      return 'working...'
    case 'waitingApproval':
      return 'waiting...'
    default:
      return ''
  }
})
</script>

<template>
  <div class="terminal-output">
    <!-- 输出行列表 -->
    <div
      v-for="(line, index) in lines"
      :key="index"
      class="output-line"
      :class="getLineClass(line)"
    >
      <!-- 前缀符号 -->
      <span class="line-prefix">{{ getLinePrefix(line) }}</span>

      <!-- 内容 -->
      <template v-if="line.type === 'link'">
        <a
          :href="line.linkUrl || '#'"
          class="line-content"
          target="_blank"
          rel="noopener noreferrer"
          @click.prevent
        >
          {{ line.content }}
        </a>
      </template>
      <template v-else-if="line.type === 'thinking'">
        <span class="line-content">
          <span class="thinking-text">{{ line.content }}</span>
          <span class="thinking-cursor" />
        </span>
      </template>
      <template v-else>
        <span class="line-content">{{ line.content }}</span>
      </template>
    </div>

    <!-- 如果没有任何输出行，根据状态显示默认提示 -->
    <div v-if="lines.length === 0" class="output-line line-default" :class="`status-${status}`">
      <span class="default-text">{{ statusLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.terminal-output {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  max-height: 24px;
  overflow: hidden;
  padding-right: 2px;
}

.terminal-output::-webkit-scrollbar {
  width: 3px;
}

/* ===== 输出行基础样式 ===== */
.output-line {
  display: flex;
  align-items: flex-start;
  word-break: break-all;
  overflow-wrap: break-word;
}

.line-prefix {
  flex-shrink: 0;
  font-weight: 500;
  user-select: none;
}

.line-content {
  flex: 1;
  min-width: 0;
}

/* ===== Prompt 行 ($ 开头) ===== */
.line-prompt {
  color: #ffffff;
}

.line-prompt .line-prefix {
  color: rgba(255, 255, 255, 0.3);
}

/* ===== Output 行 (> 开头) ===== */
.line-output {
  color: #ffffff;
}

.line-output .line-prefix {
  color: #4ade80;
  font-weight: 600;
}

.line-output .line-content {
  color: #ffffff;
}

/* ===== Thinking 行（光标闪烁） ===== */
.line-thinking {
  color: rgba(255, 255, 255, 0.35);
}

.line-thinking .line-content {
  color: rgba(255, 255, 255, 0.35);
}

.thinking-text {
  display: block;
  max-height: 3.2em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
}

/* Thinking 光标 */
.thinking-cursor {
  display: inline-block;
  width: 7px;
  height: 14px;
  background: var(--text-secondary);
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: cursorBlink 0.8s step-end infinite;
  border-radius: 1px;
}

/* ===== 链接行 ===== */
.line-link {
  color: #60a5fa;
}

.line-link .line-content {
  color: #60a5fa;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.line-link .line-content:hover {
  color: #93c5fd;
}

/* ===== 命令行 ===== */
.line-command {
  color: #ffffff;
}

.line-command .line-prefix {
  color: rgba(255, 255, 255, 0.3);
}

/* ===== 默认状态提示（无内容时） ===== */
.line-default {
  color: #4ade80;
}

.line-default.status-waitingApproval {
  color: #fb923c;
}

.line-default.status-responding {
  color: #60a5fa;
}

.default-text {
  font-size: 12px;
  font-weight: 500;
  animation: textPulse 1.5s ease-in-out infinite;
}

@keyframes textPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Markdown rendering disabled in SessionCard context */
</style>
