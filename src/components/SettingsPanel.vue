<script setup lang="ts">
/**
 * SettingsPanel - 设置面板组件
 * 弹出式模态框，包含开机启动、贴边吸附、主题等设置
 */
import { useNotchStore } from '../stores/notchStore'

const store = useNotchStore()

/**
 * 切换设置项
 */
function toggleSetting(key: 'autoStart' | 'edgeDock'): void {
  store.updateSettings({
    [key]: !store.settings[key]
  })
}

/**
 * 设置主题
 */
function setTheme(theme: 'dark' | 'light' | 'auto'): void {
  store.updateSettings({ theme })
}

/**
 * 关闭设置面板
 */
function handleClose(): void {
  store.closeSettings()
}
</script>

<template>
  <div class="settings-overlay" @click="handleClose">
    <div class="settings-panel" @click.stop>
      <!-- 面板标题 -->
      <div class="settings-header">
        <h3 class="settings-title">设置</h3>
        <button class="close-btn" @click="handleClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 设置项列表 -->
      <div class="settings-content">
        <!-- 开机启动 -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">开机启动</span>
            <span class="setting-desc">开机时自动启动 Vibe Notch</span>
          </div>
          <button
            class="toggle-switch"
            :class="{ 'is-on': store.settings.autoStart }"
            @click="toggleSetting('autoStart')"
          >
            <span class="toggle-thumb" />
          </button>
        </div>

        <!-- 贴边吸附 -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">贴边吸附</span>
            <span class="setting-desc">自动吸附到屏幕边缘</span>
          </div>
          <button
            class="toggle-switch"
            :class="{ 'is-on': store.settings.edgeDock }"
            @click="toggleSetting('edgeDock')"
          >
            <span class="toggle-thumb" />
          </button>
        </div>

        <!-- 分割线 -->
        <div class="divider" />

        <!-- 主题选择 -->
        <div class="setting-item vertical">
          <div class="setting-info">
            <span class="setting-label">主题</span>
          </div>
          <div class="theme-options">
            <button
              v-for="theme in ['dark', 'light', 'auto'] as const"
              :key="theme"
              class="theme-btn"
              :class="{ 'is-active': store.settings.theme === theme }"
              @click="setTheme(theme)"
            >
              <span class="theme-icon">
                <!-- Dark 图标 -->
                <template v-if="theme === 'dark'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                </template>
                <!-- Light 图标 -->
                <template v-else-if="theme === 'light'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </template>
                <!-- Auto 图标 -->
                <template v-else>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                    <path d="M6 17h12" />
                  </svg>
                </template>
              </span>
              <span class="theme-label">{{ theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : '自动' }}</span>
            </button>
          </div>
        </div>

        <!-- 快捷键 -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">快捷键</span>
            <span class="setting-desc">切换 Vibe Notch 显示/隐藏</span>
          </div>
          <kbd class="shortcut-key">{{ store.settings.shortcut }}</kbd>
        </div>
      </div>

      <!-- 版本信息 -->
      <div class="settings-footer">
        <span class="version">Vibe Notch v1.0.0</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 遮罩层 ===== */
.settings-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

/* ===== 设置面板 ===== */
.settings-panel {
  width: 340px;
  background: var(--bg-secondary);
  backdrop-filter: var(--backdrop-blur-heavy);
  -webkit-backdrop-filter: var(--backdrop-blur-heavy);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

/* ===== 面板头部 ===== */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
}

.settings-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

/* ===== 设置内容 ===== */
.settings-content {
  padding: 8px 16px;
}

/* ===== 设置项 ===== */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  gap: 12px;
}

.setting-item.vertical {
  flex-direction: column;
  align-items: flex-start;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--text-primary);
}

.setting-desc {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

/* 分割线 */
.divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

/* ===== 切换开关 ===== */
.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
  padding: 0;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toggle-switch:hover {
  background: rgba(255, 255, 255, 0.2);
}

.toggle-switch.is-on {
  background: var(--accent-green);
  border-color: var(--accent-green);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch.is-on .toggle-thumb {
  transform: translateX(18px);
}

/* ===== 主题选项 ===== */
.theme-options {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.theme-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  color: var(--text-muted);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-color-hover);
}

.theme-btn.is-active {
  color: var(--text-primary);
  background: var(--bg-active);
  border-color: var(--border-color-active);
}

.theme-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-transform: capitalize;
}

/* ===== 快捷键 ===== */
.shortcut-key {
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}

/* ===== 底部版本信息 ===== */
.settings-footer {
  padding: 10px 16px;
  text-align: center;
  border-top: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.02);
}

.version {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}
</style>
