/**
 * 动画系统 — Spring 函数、动画状态管理
 * 精确移植自 macOS NotchAnimation + MascotView 动画数学
 */

// ─── Spring 预设（精确移植自 macOS NotchAnimation） ───

export interface SpringConfig {
  response: number;     // 弹簧响应时间（秒）
  dampingFraction: number; // 阻尼比（1.0 = 临界阻尼）
}

export const SPRING_PRESETS = {
  /** 展开：微弹 */
  open: { response: 0.42, dampingFraction: 0.82 },
  /** 收起：临界阻尼无过冲 */
  close: { response: 0.38, dampingFraction: 1.0 },
  /** 通知弹出：快速弹跳 */
  pop: { response: 0.3, dampingFraction: 0.65 },
  /** 微交互：hover/按钮 */
  micro: { duration: 0.12 },
} as const;

// ─── Spring 物理模拟 ───

/**
 * 计算 spring 动画在时间 t 的值
 * 基于 damped harmonic oscillator: x(t) = 1 - e^(-ζωt) * cos(ωd*t - φ)
 */
export function springValue(
  t: number,
  config: SpringConfig,
): number {
  const { response, dampingFraction } = config;
  const omega = (2 * Math.PI) / response; // 自然频率
  const zeta = dampingFraction;            // 阻尼比

  if (zeta >= 1) {
    // 临界阻尼或过阻尼
    const wd = omega * Math.sqrt(zeta * zeta - 1);
    if (zeta === 1) {
      // 临界阻尼: x(t) = 1 - (1 + ωt) * e^(-ωt)
      return 1 - (1 + omega * t) * Math.exp(-omega * t);
    }
    // 过阻尼
    const s1 = -omega * (zeta - Math.sqrt(zeta * zeta - 1));
    const s2 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - ((s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1));
  }

  // 欠阻尼: x(t) = 1 - e^(-ζωt) * (cos(wd*t) + (ζω/wd)*sin(wd*t))
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return (
    1 -
    Math.exp(-zeta * omega * t) *
      (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
  );
}

// ─── 动画插值工具 ───

/**
 * 线性插值（关键帧之间）
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 在关键帧数组中插值
 * @param time 当前时间（归一化 0~1）
 * @param keyframes [[时间, 值], ...]
 */
export function lerpKeyframes(
  time: number,
  keyframes: [number, number][],
): number {
  if (keyframes.length === 0) return 0;
  if (time <= keyframes[0][0]) return keyframes[0][1];
  if (time >= keyframes[keyframes.length - 1][0])
    return keyframes[keyframes.length - 1][1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    const [t0, v0] = keyframes[i];
    const [t1, v1] = keyframes[i + 1];
    if (time >= t0 && time <= t1) {
      const localT = (time - t0) / (t1 - t0);
      return lerp(v0, v1, localT);
    }
  }

  return keyframes[keyframes.length - 1][1];
}

// ─── 角色动画状态 ───

export type MascotAnimState = 'idle' | 'working' | 'alert';

// ─── rAF Spring 动画驱动器 ───

export type SpringCallback = (value: number) => void;
export type SpringCompletion = () => void;

/**
 * rAF 驱动的 Spring 动画
 * 将弹簧物理模拟映射到 0→1 的进度值
 */
export class SpringAnimator {
  private startTime: number = 0;
  private duration: number = 0;
  private config: SpringConfig;
  private callback: SpringCallback;
  private completion?: SpringCompletion;
  private animationId: number | null = null;
  private running: boolean = false;

  constructor(config: SpringConfig, callback: SpringCallback, completion?: SpringCompletion) {
    this.config = config;
    this.callback = callback;
    this.completion = completion;
  }

  /**
   * 启动动画
   */
  start(): void {
    this.stop();
    this.running = true;
    this.startTime = performance.now();
    // 预计算时间：系统自然频率 2 次 + 0.5s 缓冲
    this.duration = this.config.response * 2 + 0.5;
    this.tick();
  }

  /**
   * 停止动画
   */
  stop(): void {
    this.running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 是否在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  private tick = (): void => {
    if (!this.running) return;

    const elapsed = (performance.now() - this.startTime) / 1000;

    if (elapsed >= this.duration) {
      this.callback(1);
      this.running = false;
      this.completion?.();
      return;
    }

    const value = springValue(elapsed, this.config);
    this.callback(value);
    this.animationId = requestAnimationFrame(this.tick);
  };
}

// ─── MorphText 文字变形动画 ───

export class MorphTextAnimator {
  private element: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  /**
   * 切换文字带模糊过渡
   * blur(40ms) → 等待(60ms) → 替换文字 → unblur(60ms)
   */
  morph(newText: string): void {
    if (this.element.textContent === newText) return;

    if (this.timer) clearTimeout(this.timer);

    // Phase 1: 模糊
    this.element.classList.remove('morph-text--clear');
    this.element.classList.add('morph-text--blur');

    this.timer = setTimeout(() => {
      // Phase 2: 替换文字
      this.element.textContent = newText;

      // Phase 3: 清晰
      this.element.classList.remove('morph-text--blur');
      this.element.classList.add('morph-text--clear');

      this.timer = setTimeout(() => {
        this.element.classList.remove('morph-text--clear');
      }, 60);
    }, 100); // blur 40ms + wait 60ms
  }
}

// ─── blurFade 内容切换过渡 ───

/**
 * 执行内容切换的 blurFade 过渡
 * @param oldEl 旧内容
 * @param newEl 新内容
 * @param container 容器
 * @param duration 过渡时长
 */
export function blurFadeTransition(
  oldEl: HTMLElement | null,
  newEl: HTMLElement | null,
  container: HTMLElement,
  duration: number = 120,
): void {
  if (oldEl) {
    oldEl.style.transition = `opacity ${duration}ms ease-out, filter ${duration}ms ease-out`;
    oldEl.style.filter = 'blur(5px)';
    oldEl.style.opacity = '0';
  }

  if (newEl) {
    // 先隐藏新内容
    newEl.style.display = 'block';
    newEl.style.transition = `opacity ${duration}ms ease-out, filter ${duration}ms ease-out`;
    newEl.style.filter = 'blur(5px)';
    newEl.style.opacity = '0';

    // 延迟后显示
    setTimeout(() => {
      newEl.style.filter = 'blur(0)';
      newEl.style.opacity = '1';
    }, duration / 2);
  }
}

// ─── Alert 跳跃关键帧（精确移植自 macOS） ───

export const ALERT_JUMP_KEYFRAMES: [number, number][] = [
  [0.00, 0],
  [0.03, 0],
  [0.10, -1],
  [0.15, 1.5],
  [0.175, -10],
  [0.20, -10],
  [0.25, 1.5],
  [0.275, -8],
  [0.30, -8],
  [0.35, 1.2],
  [0.375, -5],
  [0.40, -5],
  [0.45, 1.0],
  [0.475, -3],
  [0.50, -3],
  [0.55, 0.5],
  [0.62, 0],
  [1.00, 0],
];

// ─── Alert 手臂挥舞关键帧 ───

export const ALERT_ARM_LEFT_KEYFRAMES: [number, number][] = [
  [0.00, 0],
  [0.03, 0],
  [0.10, 25],
  [0.15, 30],
  [0.20, 155],
  [0.25, 115],
  [0.30, 140],
  [0.35, 100],
  [0.40, 115],
  [0.45, 80],
  [0.50, 80],
  [0.55, 40],
  [0.62, 0],
  [1.00, 0],
];

// 右臂 = 左臂取反
export const ALERT_ARM_RIGHT_KEYFRAMES: [number, number][] =
  ALERT_ARM_LEFT_KEYFRAMES.map(([t, v]) => [t, -v]);

// ─── Alert 感叹号缩放关键帧 ───

export const ALERT_BANG_SCALE_KEYFRAMES: [number, number][] = [
  [0.00, 0.3],
  [0.03, 1.3],
  [0.10, 1.0],
  [0.55, 1.0],
  [0.62, 0.6],
  [1.00, 0.6],
];

// ─── Alert 感叹号透明度关键帧 ───

export const ALERT_BANG_OPACITY_KEYFRAMES: [number, number][] = [
  [0.00, 0],
  [0.03, 1],
  [0.55, 1],
  [0.62, 0],
  [1.00, 0],
];
