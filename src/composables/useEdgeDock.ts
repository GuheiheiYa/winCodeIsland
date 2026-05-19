import { ref, onMounted, onUnmounted } from 'vue'
import type { DockPosition } from '../types'

/**
 * 贴边吸附逻辑
 * 检测窗口是否靠近屏幕边缘并自动吸附
 */
export function useEdgeDock() {
  const dockPosition = ref<DockPosition>('none')
  const isDocked = ref(false)

  /**
   * 检测并执行贴边
   */
  function checkAndDock(
    x: number,
    y: number,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
    threshold = 40
  ): DockPosition {
    let position: DockPosition = 'none'

    if (y <= threshold) {
      position = 'top'
    } else if (y + height >= screenHeight - threshold) {
      position = 'bottom'
    } else if (x <= threshold) {
      position = 'left'
    } else if (x + width >= screenWidth - threshold) {
      position = 'right'
    }

    dockPosition.value = position
    isDocked.value = position !== 'none'

    return position
  }

  /**
   * 手动贴边
   */
  function dockTo(position: DockPosition): void {
    dockPosition.value = position
    isDocked.value = position !== 'none'
  }

  /**
   * 解除贴边
   */
  function undock(): void {
    dockPosition.value = 'none'
    isDocked.value = false
  }

  return {
    dockPosition,
    isDocked,
    checkAndDock,
    dockTo,
    undock
  }
}
