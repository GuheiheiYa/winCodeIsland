<script setup lang="ts">
/**
 * TerminalOutput - 终端输出行组件
 * 显示带颜色的终端输出：$灰色, >绿色, 链接蓝色, thinking光标闪烁
 * 参考设计：img_1.png 中的终端输出区域
 */
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
</script>

<template>
  <div class="terminal-output">
    <!-- 输出行列表（最多展示3行） -->
    <div
      v-for="(line, index) in lines.slice(0, 3)"
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
          {{ line.content }}
          <span class="thinking-cursor" />
        </span>
      </template>
      <template v-else>
        <span class="line-content">{{ line.content }}</span>
      </template>
    </div>

    <!-- 如果会话是 thinking 状态且没有 thinking 输出行，显示默认 thinking -->
    <div v-if="status === 'thinking' && !lines.some(l => l.type === 'thinking')" class="output-line line-thinking">
      <span class="line-content">
        thinking
        <span class="thinking-cursor" />
      </span>
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
  line-height: 1.7;
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
</style>
