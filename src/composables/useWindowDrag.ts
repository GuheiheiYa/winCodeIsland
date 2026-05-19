import { ref } from 'vue'

/**
 * 窗口拖拽逻辑
 * 处理无边框窗口的拖拽移动
 */
export function useWindowDrag() {
  const isDragging = ref(false)
  const dragStartPos = ref({ x: 0, y: 0 })

  /**
   * 开始拖拽
   */
  function startDrag(event: MouseEvent): void {
    isDragging.value = true
    dragStartPos.value = {
      x: event.screenX,
      y: event.screenY
    }

    // 通知主进程拖拽开始
    if (window.electronAPI) {
      // 使用 IPC 通知主进程
      const customEvent = new CustomEvent('app-drag-start', {
        detail: { x: event.screenX, y: event.screenY }
      })
      window.dispatchEvent(customEvent)
    }

    // 添加全局鼠标事件监听
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  }

  /**
   * 拖拽中
   */
  function onDragMove(event: MouseEvent): void {
    if (!isDragging.value) return

    if (window.electronAPI) {
      const customEvent = new CustomEvent('app-drag-move', {
        detail: { x: event.screenX, y: event.screenY }
      })
      window.dispatchEvent(customEvent)
    }
  }

  /**
   * 结束拖拽
   */
  function onDragEnd(event: MouseEvent): void {
    if (!isDragging.value) return

    isDragging.value = false

    if (window.electronAPI) {
      const customEvent = new CustomEvent('app-drag-end', {
        detail: { x: event.screenX, y: event.screenY }
      })
      window.dispatchEvent(customEvent)
    }

    // 移除全局监听
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
  }

  return {
    isDragging,
    startDrag
  }
}
