/**
 * 音效服务 - 8-bit 风格音效播放
 * 为会话状态变化提供声音反馈
 */

export type SoundType = 'boot' | 'start' | 'complete' | 'approval' | 'error' | 'submit'

const SOUND_FILES: Record<SoundType, string> = {
  boot: './resources/sounds/8bit_boot.wav',
  start: './resources/sounds/8bit_start.wav',
  complete: './resources/sounds/8bit_complete.wav',
  approval: './resources/sounds/8bit_approval.wav',
  error: './resources/sounds/8bit_error.wav',
  submit: './resources/sounds/8bit_submit.wav'
}

/** 各音效的冷却时间（ms），防止重复触发 */
const COOLDOWN_MS: Record<SoundType, number> = {
  boot: 0,      // 启动只播放一次
  start: 2000,  // AI 开始工作
  complete: 2000,
  approval: 3000, // 需要确认，间隔长一点
  error: 1000,
  submit: 1000
}

class SoundService {
  private sounds = new Map<SoundType, HTMLAudioElement>()
  private enabled = true
  private cooldowns = new Map<SoundType, number>()
  private bootPlayed = false

  constructor() {
    // 预加载音效文件
    for (const [type, path] of Object.entries(SOUND_FILES)) {
      const audio = new Audio(path)
      audio.preload = 'auto'
      this.sounds.set(type as SoundType, audio)
    }
  }

  /** 设置是否启用音效 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /** 获取当前是否启用 */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 播放指定音效
   * @param type 音效类型
   * @param force 是否强制播放（忽略冷却和开关）
   */
  play(type: SoundType, force = false): void {
    if (!force && !this.enabled) return
    if (!force && this.isOnCooldown(type)) return

    const audio = this.sounds.get(type)
    if (!audio) return

    // 重置并播放
    audio.currentTime = 0
    audio.volume = 0.6
    audio.play().catch(() => {
      // 浏览器可能阻止自动播放，静默失败
    })

    // 更新冷却时间
    this.cooldowns.set(type, Date.now())
  }

  /** 播放启动音效（只播放一次） */
  playBoot(): void {
    if (this.bootPlayed) return
    this.bootPlayed = true
    this.play('boot', true)
  }

  /** 检查是否在冷却中 */
  private isOnCooldown(type: SoundType): boolean {
    const last = this.cooldowns.get(type)
    if (!last) return false
    return Date.now() - last < COOLDOWN_MS[type]
  }
}

export const soundService = new SoundService()
