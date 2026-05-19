/**
 * Canvas 2D 渲染引擎 — 像素章鱼角色渲染
 * 精确移植自 macOS ClawdView (PixelCharacterView.swift)
 */

import {
  CLAWD_COLORS,
  SCENE_VIEWPORTS,
  createViewportMapper,
  mapRect,
  armPath,
  drawArmPolygon,
  ViewportMapper,
} from './sprites';
import {
  lerpKeyframes,
  ALERT_JUMP_KEYFRAMES,
  ALERT_ARM_LEFT_KEYFRAMES,
  ALERT_ARM_RIGHT_KEYFRAMES,
  ALERT_BANG_SCALE_KEYFRAMES,
  ALERT_BANG_OPACITY_KEYFRAMES,
} from './animations';

type MascotStatus = 'idle' | 'processing' | 'running' | 'waitingApproval' | 'waitingQuestion';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private startTime: number = 0;
  private speed: number = 1.0; // 动画速度系数

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');
    this.ctx = ctx;
    this.startTime = performance.now();
    console.log('[CanvasRenderer] 初始化完成, canvas size:', canvas.width, 'x', canvas.height);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /**
   * 启动 rAF 动画循环
   */
  startLoop(getStatus: () => MascotStatus): void {
    const loop = (timestamp: number): void => {
      const t = ((timestamp - this.startTime) / 1000) * this.speed;
      const status = getStatus();
      this.render(t, status);
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stopLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 主渲染函数 — 根据状态路由到对应场景
   */
  private render(t: number, status: MascotStatus): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.imageSmoothingEnabled = false;

    switch (status) {
      case 'idle':
        this.renderSleepScene(t, width, height);
        break;
      case 'processing':
      case 'running':
        this.renderWorkScene(t, width, height);
        break;
      case 'waitingApproval':
      case 'waitingQuestion':
        this.renderAlertScene(t, width, height);
        break;
    }
  }

  // ─────────────────────────────────────────────
  // 睡眠场景（idle）
  // ─────────────────────────────────────────────

  private renderSleepScene(t: number, w: number, h: number): void {
    const v = createViewportMapper(w, h, SCENE_VIEWPORTS.sleep);
    const { ctx } = this;

    // 呼吸计算：4.5 秒周期
    const phase = (t % 4.5) / 4.5;
    const breathe = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) : 0;
    const puff = Math.max(0, breathe) * 0.25;

    // 阴影
    const shadowScale = 1 + breathe * 0.03;
    ctx.fillStyle = `rgba(0,0,0,${0.35 + breathe * 0.08})`;
    ctx.fillRect(...mapRect(v, -1, 15, 17 * shadowScale, 1));

    // 4 条腿
    ctx.fillStyle = CLAWD_COLORS.body;
    ctx.fillRect(...mapRect(v, 3, 8.5, 1, 1.5));
    ctx.fillRect(...mapRect(v, 5, 8.5, 1, 1.5));
    ctx.fillRect(...mapRect(v, 9, 8.5, 1, 1.5));
    ctx.fillRect(...mapRect(v, 11, 8.5, 1, 1.5));

    // 躯体（随呼吸膨胀）
    const torsoW = 13 * (1 + breathe * 0.015);
    const torsoH = 5 * (1 + puff);
    const torsoY = 15 - torsoH;
    const torsoX = -1 + (17 - torsoW) / 2; // 居中补偿
    ctx.fillStyle = CLAWD_COLORS.body;
    ctx.fillRect(...mapRect(v, torsoX, torsoY, torsoW, torsoH));

    // 左臂（平放在地面）
    ctx.fillRect(...mapRect(v, -1, 13, 2, 2));
    // 右臂
    ctx.fillRect(...mapRect(v, 14, 13, 2, 2));

    // 眼睛（闭眼 = 水平细缝）
    ctx.fillStyle = CLAWD_COLORS.eye;
    const eyeY = 12.2 - puff * 2.5;
    ctx.fillRect(...mapRect(v, 3, eyeY, 2.5, 1.0));
    ctx.fillRect(...mapRect(v, 9.5, eyeY, 2.5, 1.0));

    // 浮动 Z
    this.renderFloatingZ(t, v, w, h);
  }

  /**
   * 渲染浮动的 Zzz 文字
   */
  private renderFloatingZ(t: number, v: ViewportMapper, _w: number, h: number): void {
    const { ctx } = this;
    const size = h;

    for (let i = 0; i < 3; i++) {
      const cycle = 2.8 + i * 0.3;
      const delay = i * 0.9;
      const phase = ((t - delay) % cycle) / cycle;
      if (phase < 0) continue; // 还没开始

      const baseOpacity = 0.7 - i * 0.1;
      // 最后 20% 淡出
      const opacity = phase > 0.8 ? (1 - phase) * 3.5 * baseOpacity : baseOpacity;
      if (opacity <= 0) continue;

      const fontSize = Math.max(6, size * (0.18 + phase * 0.10));
      const xOff = size * (0.08 + i * 0.06 + Math.sin(phase * Math.PI * 2) * 0.03);
      const yOff = -(size * (0.15 + phase * 0.38));

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Z 位于角色右上方
      const zx = v.ox + (14 + xOff) * v.s;
      const zy = v.oy + (8 + yOff - v.y0) * v.s;
      ctx.fillText('z', zx, zy);
      ctx.restore();
    }
  }

  // ─────────────────────────────────────────────
  // 工作场景（processing/running）
  // ─────────────────────────────────────────────

  private renderWorkScene(t: number, w: number, h: number): void {
    const v = createViewportMapper(w, h, SCENE_VIEWPORTS.work);
    const { ctx } = this;

    // 弹跳：0.35s 周期
    const bounce = Math.sin((t * 2 * Math.PI) / 0.35) * 1.2;
    // 呼吸：3.2s 周期
    const breathe = Math.sin((t * 2 * Math.PI) / 3.2);
    const bScale = 1 + breathe * 0.015;
    const dy = bounce;

    // 阴影
    const shadowW = 9 - Math.abs(dy) * 0.3;
    const shadowX = 3 + (9 - shadowW) / 2;
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.1, 0.4 - Math.abs(dy) * 0.03)})`;
    ctx.fillRect(...mapRect(v, shadowX, 15, shadowW, 1));

    // 键盘（在腿前面）
    this.renderKeyboard(t, v, dy);

    // 4 条腿（键盘后面）
    ctx.fillStyle = CLAWD_COLORS.body;
    ctx.fillRect(...mapRect(v, 3, 13, 1, 2, dy));
    ctx.fillRect(...mapRect(v, 5, 13, 1, 2, dy));
    ctx.fillRect(...mapRect(v, 9, 13, 1, 2, dy));
    ctx.fillRect(...mapRect(v, 11, 13, 1, 2, dy));

    // 躯体
    const torsoW = 11 * bScale;
    const compens = (torsoW - 11) / 2;
    ctx.fillStyle = CLAWD_COLORS.body;
    ctx.fillRect(...mapRect(v, 2 - compens, 6, torsoW, 7, dy));

    // 手臂打字动画
    this.renderTypingArms(t, v, dy);

    // 眼睛
    this.renderWorkEyes(t, v, dy);
  }

  /**
   * 渲染键盘
   */
  private renderKeyboard(t: number, v: ViewportMapper, dy: number): void {
    const { ctx } = this;

    // 键盘底座
    ctx.fillStyle = CLAWD_COLORS.kbBase;
    ctx.fillRect(...mapRect(v, -0.5, 11.8, 16, 3.5, dy));

    // 按键网格 6列 x 3行
    ctx.fillStyle = CLAWD_COLORS.kbKey;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const kw = col === 2 && row === 1 ? 4.5 : 2.0;
        const kx = 0.3 + col * 2.5;
        const ky = 12.2 + row * 1.0;
        ctx.fillRect(...mapRect(v, kx, ky, kw, 0.7, dy));
      }
    }

    // 按键闪烁（同步手臂位置）
    const armLRaw = (Math.sin((t * 2 * Math.PI) / 0.15) + 1) / 2;
    const armRRaw = (Math.sin((t * 2 * Math.PI) / 0.12) + 1) / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    if (armLRaw > 0.3) {
      const flashCol = Math.floor(t / 0.15) % 3;
      ctx.fillRect(...mapRect(v, 0.3 + flashCol * 2.5, 12.2, 2.0, 0.7, dy));
    }
    if (armRRaw > 0.3) {
      const flashCol = 3 + Math.floor(t / 0.12) % 3;
      const kw = flashCol === 4 ? 4.5 : 2.0;
      ctx.fillRect(...mapRect(v, 0.3 + flashCol * 2.5, 12.2, kw, 0.7, dy));
    }
  }

  /**
   * 渲染打字手臂
   */
  private renderTypingArms(t: number, v: ViewportMapper, dy: number): void {
    // 左臂角度：-55 到 -10 度，0.15s 周期
    const armLAngle = Math.sin((t * 2 * Math.PI) / 0.15) * 22.5 - 32.5;
    // 右臂角度：10 到 55 度，0.12s 周期
    const armRAngle = Math.sin((t * 2 * Math.PI) / 0.12) * 22.5 + 32.5;

    // 左臂：rect(0, 9, 2, 2), pivot(2, 10)
    const leftArm = armPath(v, 0, 9, 2, 2, 2, 10, armLAngle, dy);
    drawArmPolygon(this.ctx, leftArm, CLAWD_COLORS.body);

    // 右臂：rect(13, 9, 2, 2), pivot(13, 10)
    const rightArm = armPath(v, 13, 9, 2, 2, 13, 10, armRAngle, dy);
    drawArmPolygon(this.ctx, rightArm, CLAWD_COLORS.body);
  }

  /**
   * 渲染工作场景眼睛（眯眼 + 眨眼 + 扫视）
   */
  private renderWorkEyes(t: number, v: ViewportMapper, dy: number): void {
    const { ctx } = this;

    // 默认眯眼
    let eyeScale = 0.5;
    let eyeDY = 0;

    // 扫视：10s 周期中 5.7~6.9 区间
    const scanPhase = (t % 10) / 10;
    if (scanPhase > 0.57 && scanPhase < 0.69) {
      eyeScale = 1.0;
      eyeDY = -0.5;
    }

    // 眨眼：3.5s 周期中 1.4~1.55 区间
    const blinkPhase = (t % 3.5) / 3.5;
    if (blinkPhase > 0.4 && blinkPhase < 0.443) {
      eyeScale = 0.1;
    }

    const eyeH = 2 * eyeScale;
    const eyeW = 1;
    const baseY = 8 + (2 - eyeH) / 2 + eyeDY;

    ctx.fillStyle = CLAWD_COLORS.eye;
    ctx.fillRect(...mapRect(v, 4, baseY, eyeW, eyeH, dy));
    ctx.fillRect(...mapRect(v, 10, baseY, eyeW, eyeH, dy));
  }

  // ─────────────────────────────────────────────
  // 告警场景（waitingApproval / waitingQuestion）
  // ─────────────────────────────────────────────

  private renderAlertScene(t: number, w: number, h: number): void {
    const v = createViewportMapper(w, h, SCENE_VIEWPORTS.alert);
    const { ctx } = this;

    // 3.5 秒周期
    const cycleTime = (t % 3.5) / 3.5;

    // 跳跃 Y
    const jumpY = lerpKeyframes(cycleTime, ALERT_JUMP_KEYFRAMES);

    // 压扁/拉伸（落地时 jumpY > 0.5）
    let scaleX = 1.0;
    let scaleY = 1.0;
    if (jumpY > 0.5) {
      scaleX = 1.0 + jumpY * 0.05;
      scaleY = 1.0 - jumpY * 0.04;
    }

    // 手臂挥舞
    const armLeftAngle = lerpKeyframes(cycleTime, ALERT_ARM_LEFT_KEYFRAMES);
    const armRightAngle = lerpKeyframes(cycleTime, ALERT_ARM_RIGHT_KEYFRAMES);

    // 眼睛惊吓
    let eyeScale = 1.0;
    let eyeDY = 0;
    if (cycleTime > 0.03 && cycleTime < 0.15) {
      eyeScale = 1.3;
      eyeDY = -0.5;
    }

    // 感叹号
    const bangScale = lerpKeyframes(cycleTime, ALERT_BANG_SCALE_KEYFRAMES);
    const bangOpacity = lerpKeyframes(cycleTime, ALERT_BANG_OPACITY_KEYFRAMES);

    // 红色光晕
    const glowPulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2); // 0.5s 脉冲
    const glowSize = w * 0.4;
    const gradient = ctx.createRadialGradient(
      w / 2, h / 2, 0,
      w / 2, h / 2, glowSize,
    );
    gradient.addColorStop(0, `rgba(255, 61, 0, ${0.12 * glowPulse})`);
    gradient.addColorStop(1, 'rgba(255, 61, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 阴影
    const shadowW = 9 * (1 - Math.abs(Math.min(0, jumpY)) * 0.04);
    const shadowX = 3 + (9 - shadowW) / 2;
    ctx.fillStyle = `rgba(0,0,0,0.3)`;
    ctx.fillRect(...mapRect(v, shadowX, 15, shadowW, 1));

    // 4 条腿
    ctx.fillStyle = CLAWD_COLORS.body;
    ctx.fillRect(...mapRect(v, 3, 11, 1, 4, jumpY));
    ctx.fillRect(...mapRect(v, 5, 11, 1, 4, jumpY));
    ctx.fillRect(...mapRect(v, 9, 11, 1, 4, jumpY));
    ctx.fillRect(...mapRect(v, 11, 11, 1, 4, jumpY));

    // 躯体（压扁/拉伸）
    const torsoW = 11 * scaleX;
    const torsoH = 7 * scaleY;
    const torsoCompens = (torsoW - 11) / 2;
    ctx.fillStyle = CLAWD_COLORS.body;
    ctx.fillRect(...mapRect(v, 2 - torsoCompens, 6 + (7 - torsoH), torsoW, torsoH, jumpY));

    // 手臂挥舞
    const leftArmPts = armPath(v, 0, 9, 2, 2, 2, 10, armLeftAngle, jumpY);
    drawArmPolygon(ctx, leftArmPts, CLAWD_COLORS.body);
    const rightArmPts = armPath(v, 13, 9, 2, 2, 13, 10, armRightAngle, jumpY);
    drawArmPolygon(ctx, rightArmPts, CLAWD_COLORS.body);

    // 眼睛
    const eyeH = 2 * eyeScale;
    const eyeBaseY = 8 + (2 - eyeH) / 2 + eyeDY;
    ctx.fillStyle = CLAWD_COLORS.eye;
    ctx.fillRect(...mapRect(v, 4, eyeBaseY, 1, eyeH, jumpY));
    ctx.fillRect(...mapRect(v, 10, eyeBaseY, 1, eyeH, jumpY));

    // 感叹号 (!)
    if (bangOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = bangOpacity;
      ctx.fillStyle = CLAWD_COLORS.alert;

      const bangX = 13;
      const bangBaseY = 4.5 + jumpY * 0.15;
      const bw = 2 * bangScale;

      // 竖线
      ctx.fillRect(...mapRect(v, bangX, bangBaseY, bw, 3.5 * bangScale));
      // 圆点
      ctx.fillRect(...mapRect(v, bangX, bangBaseY + 4.0 * bangScale, bw, 1.5 * bangScale));

      ctx.restore();
    }
  }
}
