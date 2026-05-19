<script setup lang="ts">
/**
 * CollapsedBar - 收起状态组件
 * Pill 形状小条，左侧用 Canvas 绘制动态小章鱼
 * 文字、颜色随 mascot 状态联动
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useNotchStore } from '../stores/notchStore'
import { CanvasRenderer } from '../renderer/canvas/canvas-renderer'

const store = useNotchStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: CanvasRenderer | null = null
let dotsTimer: ReturnType<typeof setInterval> | null = null

const emit = defineEmits<{
  expand: []
}>()

/** 总会话数 */
const totalSessions = computed(() => store.sessionCount)

/** 当前 mascot 状态 */
const mascotStatus = computed(() => {
  const hasWorking = store.sessions.some((s) => s.status === 'working')
  const hasThinking = store.sessions.some((s) => s.status === 'thinking')

  if (hasWorking || hasThinking) return 'processing'
  return 'idle'
})

/** 状态对应的文案、颜色 */
const statusMeta = computed(() => {
  switch (mascotStatus.value) {
    case 'processing':
      return { text: '运行中', color: '#4ade80', glow: 'rgba(74,222,128,0.45)' }
    case 'waitingApproval':
      return { text: '请确认', color: '#f87171', glow: 'rgba(248,113,113,0.45)' }
    case 'idle':
    default:
      return { text: '休息中', color: '#e5e7eb', glow: 'rgba(229,231,235,0.25)' }
  }
})

/** 动态省略号 */
const dots = ref('')
const DOTS_CYCLE = ['', '.', '..', '...']

function handleClick(): void {
  emit('expand')
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const cssW = 26
  const cssH = 22

  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  renderer = new CanvasRenderer(canvas)
  renderer.setSpeed(1.2)
  renderer.startLoop(() => mascotStatus.value)

  // 省略号动画: '' → '.' → '..' → '...' 循环
  let idx = 0
  dotsTimer = setInterval(() => {
    idx = (idx + 1) % DOTS_CYCLE.length
    dots.value = DOTS_CYCLE[idx]
  }, 450)
})

onUnmounted(() => {
  renderer?.stopLoop()
  renderer = null
  if (dotsTimer) {
    clearInterval(dotsTimer)
    dotsTimer = null
  }
})
</script>

<template>
  <div
    class="collapsed-bar"
    :class="`status-${mascotStatus}`"
    @click="handleClick"
  >
    <!-- 左侧：Canvas 小章鱼 -->
    <div class="left-section">
      <canvas ref="canvasRef" class="mascot-canvas" />
      <span
        class="status-text"
        :style="{
          color: statusMeta.color,
          textShadow: `0 0 6px ${statusMeta.glow}`,
        }"
      >
        {{ statusMeta.text }}{{ dots }}
      </span>
    </div>

    <!-- 右侧：会话数量 -->
    <div class="right-section">
      <span class="session-count">{{ totalSessions }} 个会话</span>
    </div>
  </div>
</template>

<style scoped>
.collapsed-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 300px;
  height: 36px;
  padding: 0 14px 0 10px;
  background: var(--bg-secondary);
  backdrop-filter: blur(40px) saturate(1.2);
  -webkit-backdrop-filter: blur(40px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-top: none;
  border-radius: 0 0 20px 20px;
  cursor: pointer;
  user-select: none;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--shadow-lg);
  animation: scaleIn 0.3s ease;
}

.collapsed-bar::before,
.collapsed-bar::after {
  content: '';
  position: absolute;
  top: 0;
  width: 10px;
  height: 6px;
  background: transparent;
}

.collapsed-bar::before {
  left: -9px;
  border-radius: 0 5px 0 0;
  box-shadow: 2px -2px 0 rgba(255, 255, 255, 0.06);
}

.collapsed-bar::after {
  right: -9px;
  border-radius: 5px 0 0 0;
  box-shadow: -2px -2px 0 rgba(255, 255, 255, 0.06);
}

.collapsed-bar:hover {
  background: rgba(30, 30, 45, 0.98);
  border-color: var(--border-color-hover);
  box-shadow: var(--shadow-glow), var(--shadow-lg);
  transform: scale(1.02);
}

.collapsed-bar:active {
  transform: scale(0.98);
  transition-duration: 0.1s;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mascot-canvas {
  display: block;
  image-rendering: pixelated;
}

/* 科技像素风文字 */
.status-text {
  font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: color 0.35s ease, text-shadow 0.35s ease;
}

.right-section {
  display: flex;
  align-items: center;
}

.session-count {
  font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}
</style>
