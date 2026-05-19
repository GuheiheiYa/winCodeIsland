/**
 * 章鱼角色精灵定义
 * 精确移植自 macOS ClawdView (PixelCharacterView.swift)
 * 所有坐标在 SVG 单位空间中定义，由 canvas-renderer 的 V 映射到像素
 */

// ─── 颜色调色板（精确移植自 macOS） ───

export const CLAWD_COLORS = {
  body: '#DE886D',     // Color(red: 0.871, green: 0.533, blue: 0.427)
  eye: '#000000',      // 眼睛
  alert: '#FF3D00',    // Color(red: 1.0, green: 0.24, blue: 0.0) — 警告色
  kbBase: '#617080',   // 键盘底座
  kbKey: '#99A9B8',    // 键盘按键
  kbHi: '#FFFFFF',     // 按键高亮
} as const;

// ─── 场景视口参数（精确移植自 macOS） ───

export interface SceneViewport {
  svgW: number;
  svgH: number;
  svgY0: number;
}

export const SCENE_VIEWPORTS: Record<string, SceneViewport> = {
  sleep: { svgW: 17, svgH: 7, svgY0: 9 },
  work: { svgW: 16, svgH: 11, svgY0: 5.5 },
  alert: { svgW: 15, svgH: 12, svgY0: 4 },
};

// ─── 坐标映射（移植自 macOS V struct） ───

export interface ViewportMapper {
  ox: number;
  oy: number;
  s: number;
  y0: number;
}

export function createViewportMapper(
  width: number,
  height: number,
  viewport: SceneViewport,
): ViewportMapper {
  const { svgW, svgH, svgY0 } = viewport;
  const s = Math.min(width / svgW, height / svgH);
  const ox = (width - svgW * s) / 2;
  const oy = (height - svgH * s) / 2;
  return { ox, oy, s, y0: svgY0 };
}

/**
 * 将 SVG 坐标映射到 Canvas 像素坐标
 * 返回 [x, y, w, h] 像素矩形
 */
export function mapRect(
  v: ViewportMapper,
  x: number,
  y: number,
  w: number,
  h: number,
  dy: number = 0,
): [number, number, number, number] {
  return [
    v.ox + x * v.s,
    v.oy + (y - v.y0 + dy) * v.s,
    w * v.s,
    h * v.s,
  ];
}

// ─── 旋转手臂路径计算（移植自 macOS armPath） ───

export function armPath(
  v: ViewportMapper,
  x: number,
  y: number,
  w: number,
  h: number,
  pivotX: number,
  pivotY: number,
  angleDeg: number,
  dy: number = 0,
): [number, number][] {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // 4 个角点（相对于原点）
  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];

  return corners.map(([cx, cy]) => {
    // 相对于 pivot 的偏移
    const rx = cx - pivotX;
    const ry = cy - pivotY;
    // 旋转
    const rotX = rx * cos - ry * sin + pivotX;
    const rotY = rx * sin + ry * cos + pivotY;
    // 映射到屏幕坐标
    return [
      v.ox + rotX * v.s,
      v.oy + (rotY - v.y0 + dy) * v.s,
    ];
  });
}

/**
 * 绘制旋转的多边形手臂
 */
export function drawArmPolygon(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  color: string,
): void {
  if (points.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}
