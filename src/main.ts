/**
 * 渲染进程入口文件
 * 初始化 Vue 3 应用和 Pinia 状态管理
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 导入全局样式
import './styles/variables.css'
import './styles/animations.css'

/**
 * 创建 Vue 应用实例
 */
const app = createApp(App)

/**
 * 注册 Pinia 状态管理
 */
const pinia = createPinia()
app.use(pinia)

/**
 * 挂载应用
 */
app.mount('#app')

/**
 * 开发模式下的控制台提示
 */
if (import.meta.env.DEV) {
  console.log('[Vibe Notch] Renderer process started in development mode')
}
