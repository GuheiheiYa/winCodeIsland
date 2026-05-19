<script setup lang="ts">
/**
 * TopBar - 展开面板的顶部栏
 * 包含标签切换（ALL/STA/CLI）、音量、设置、关闭按钮
 * 参考设计：img_1.png 顶部区域
 */
import { useNotchStore } from '../stores/notchStore'

const store = useNotchStore()

const emit = defineEmits<{
  collapse: []
}>()

/** 标签定义 */
const tabs = [
  { key: 'all' as const, label: 'ALL' },
  { key: 'sta' as const, label: 'STA' },
  { key: 'cli' as const, label: 'CLI' }
]

function handleTabClick(tab: 'all' | 'sta' | 'cli'): void {
  store.setActiveTab(tab)
}

function handleCollapse(): void {
  emit('collapse')
}

function handleOpenSettings(): void {
  store.openSettings()
}
</script>

<template>
  <div class="top-bar">
    <!-- 左侧：带图标的标签 -->
    <div class="tabs-section">
      <span class="tab-brand-icon">
        <img src="/logo.png" width="16" height="16" />
      </span>
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ 'is-active': store.activeTab === tab.key }"
          @click="handleTabClick(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 右侧：功能按钮 -->
    <div class="actions-section">
      <!-- 音量 -->
      <button class="icon-btn" title="音量">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>
      <!-- 设置 -->
      <button class="icon-btn settings-btn" title="设置" @click="handleOpenSettings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <!-- 关闭/电源 - 红色 -->
      <button class="icon-btn power-btn" title="关闭" @click="handleCollapse">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  flex-shrink: 0;
}

/* ===== 标签区域 ===== */
.tabs-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tab-brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  opacity: 0.8;
}

.tab-brand-icon img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

.tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  /* 无背景、无边框 */
  background: transparent;
  border: none;
  padding: 0;
}

.tab-btn {
  padding: 3px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.35);
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
}

/* 选中状态 - 简洁绿色文字 */
.tab-btn.is-active {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.08);
}

/* ===== 按钮区域 ===== */
.actions-section {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  color: rgba(255, 255, 255, 0.45);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.06);
}

.icon-btn:active {
  transform: scale(0.95);
}

/* 电源按钮 - 红色 */
.power-btn {
  color: #ef4444;
  opacity: 0.85;
}

.power-btn:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  opacity: 1;
}
</style>
