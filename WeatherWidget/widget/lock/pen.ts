// 锁屏组件的画笔：Canvas（Web 2D 上下文）上画弧线、折线、圆点、柱子、渐隐的白线。
//
// 只有图形在这里画，文字和图标交给 widget/lock/view.tsx 里的真 Text / Image：
// 文字的字重、等宽数字、按框缩小这些，用视图才画得准；Canvas 里的 font 只有字号和几种系统字体名。
//
// 坐标全是设计稿的数（圆形 72×72、矩形 160×72），由 core 的 design 换算成组件上的点。

import type { LockDesign } from "./design";

/** Canvas 2D 上下文里用得到的这些；Scripting 的 CanvasRenderingContext 比这个多，这里只写用到的方法 */
export type LockContext = {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "bevel" | "miter" | "round";
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
};

export type LockPoint = { x: number; y: number };

/** 角度的度 → 弧度 */
const rad = (degrees: number): number => (degrees * Math.PI) / 180;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export class LockPen {
  private readonly ctx: LockContext;
  private readonly d: LockDesign;

  constructor(ctx: LockContext, design: LockDesign) {
    this.ctx = ctx;
    this.d = design;
  }

  /** 画布上的白色（锁屏是单色，靠透明度分主次） */
  white(alpha = 1): string {
    return `rgba(255,255,255,${clamp(alpha, 0, 1)})`;
  }

  /** 灰一点的底轨（弧线、湿度条） */
  gray(alpha = 1): string {
    return `rgba(104,104,104,${clamp(alpha, 0, 1)})`;
  }

  /** 一个圆点 */
  dot(x: number, y: number, diameter: number, color: string = this.white()): void {
    const radius = (diameter * this.d.unit) / 2;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(this.d.X(x), this.d.Y(y), radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** 折线；`round` 时两头补圆点，看起来像圆头线 */
  line(points: readonly LockPoint[], width: number, color: string = this.white(), round = false): void {
    if (points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.d.X(points[0].x), this.d.Y(points[0].y));
    for (let index = 1; index < points.length; index++) {
      this.ctx.lineTo(this.d.X(points[index].x), this.d.Y(points[index].y));
    }
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width * this.d.unit;
    this.ctx.lineCap = round ? "round" : "butt";
    this.ctx.stroke();
    if (round) {
      this.dot(points[0].x, points[0].y, width, color);
      this.dot(points[points.length - 1].x, points[points.length - 1].y, width, color);
    }
  }

  /** 圆弧：角度 0° 在右边、顺时针增加；两端圆头 */
  arc(x: number, y: number, radius: number, from: number, to: number, width: number, color: string = this.white()): void {
    if (to - from <= 0.1) return;
    this.line(this.arcPoints(x, y, radius, from, to), width, color, true);
  }

    /** 圆弧上每 3° 一个点 */
  arcPoints(x: number, y: number, radius: number, from: number, to: number): LockPoint[] {
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 3));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const angle = rad(from + ((to - from) * index) / steps);
      return { x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle) };
    });
  }

  /**
   * 沿着一条线画渐隐的白线（设计稿里的弧线、流线）：每个点的透明度由 `alphaOf(位置 0~1)` 决定。
   * 画成一条填色的带子，按需要的透明度叠 8 层很淡的白色；层与层之间没有接缝，弯的地方也不会漏出细缝。
   */
  fade(points: readonly LockPoint[], width: number, alphaOf: (t: number) => number): void {
    const count = points.length - 1;
    if (count < 1) return;
    const real = points.map((point) => ({ x: this.d.X(point.x), y: this.d.Y(point.y) }));
    const half = (width * this.d.unit) / 2;
    const sides = real.map((point, index) => {
      const before = real[Math.max(0, index - 1)];
      const after = real[Math.min(count, index + 1)];
      const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
      const nx = -(after.y - before.y) / length;
      const ny = (after.x - before.x) / length;
      return [
        { x: point.x + nx * half, y: point.y + ny * half },
        { x: point.x - nx * half, y: point.y - ny * half },
      ] as const;
    });
    const layers = 8;
    const layerAlpha = 1 - Math.pow(0.06, 1 / layers);
    const needs = points.map((_, index) => {
      const alpha = clamp(alphaOf(index / count), 0, 0.97);
      return Math.round(Math.log(1 - alpha) / Math.log(1 - layerAlpha));
    });
    for (let layer = 1; layer <= layers; layer++) {
      const first = needs.findIndex((need) => need >= layer);
      const last = needs.length - 1 - [...needs].reverse().findIndex((need) => need >= layer);
      if (first < 0 || last <= first) continue;
      // 带子的左边顺着走、右边倒着回来，围成一条闭合的窄带
      const left: LockPoint[] = [];
      const right: LockPoint[] = [];
      for (let index = first; index <= last; index++) {
        left.push({ x: sides[index][0].x, y: sides[index][0].y });
        right.push({ x: sides[index][1].x, y: sides[index][1].y });
      }
      this.polygonReal([...left, ...right.reverse()], this.white(layerAlpha));
    }
  }

  /** 填一块多边形，点的坐标已经是组件上的点（fade 里算好的边线用这个，不再换算一次） */
  polygonReal(points: readonly LockPoint[], color: string): void {
    if (points.length < 3) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index++) {
      this.ctx.lineTo(points[index].x, points[index].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  /** 三次曲线上的点（设计稿的流线、太阳轨迹） */
  bezier(p0: LockPoint, p1: LockPoint, p2: LockPoint, p3: LockPoint, count = 40): LockPoint[] {
    return Array.from({ length: count + 1 }, (_, index) => {
      const t = index / count;
      const u = 1 - t;
      const at = (a: number, b: number, c: number, e: number): number => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e;
      return { x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) };
    });
  }

  /** 填一块多边形 */
  polygon(points: readonly LockPoint[], color: string): void {    if (points.length < 3) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.d.X(points[0].x), this.d.Y(points[0].y));
    for (let index = 1; index < points.length; index++) {
      this.ctx.lineTo(this.d.X(points[index].x), this.d.Y(points[index].y));
    }
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  /** 一块实心矩形（设计稿的坐标和宽高），湿度条的底条用 */
  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.d.X(x), this.d.Y(y), width * this.d.sx, height * this.d.sy);
  }

  /** 两头圆的细条（湿度条），比方块圆润一点 */
  capsule(x: number, y: number, width: number, height: number, color: string): void {
    const w = width * this.d.sx;
    const h = height * this.d.sy;
    const radius = h / 2;
    if (w <= 0) return;
    if (w <= h) {
      this.dot(x + width / 2, y + height / 2, height, color);
      return;
    }
    // 左边半圆 + 中间矩形 + 右边半圆
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.d.X(x) + radius, this.d.Y(y), w - h, h);
    this.ctx.beginPath();
    this.ctx.arc(this.d.X(x) + radius, this.d.Y(y) + radius, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(this.d.X(x) + w - radius, this.d.Y(y) + radius, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * 雨量柱子：顶上两角是圆的，从上往下由白渐渐变灰（底部叠一层层淡淡的黑）。
   * `center`、`bottom` 是设计稿里的中心横坐标和底线，宽高也是设计稿的数。
   */
  bar(center: number, bottom: number, width: number, height: number): void {
    const w = width * this.d.sx;
    const x = this.d.X(center) - w / 2;
    const yBottom = this.d.Y(bottom);
    const yTop = yBottom - height * this.d.sy;
    const radius = Math.min(3 * this.d.unit, w / 2, yBottom - yTop);
    this.ctx.beginPath();
    this.ctx.moveTo(this.d.X(center) - w / 2, yBottom);
    this.ctx.lineTo(x, yTop + radius);
    this.ctx.quadraticCurveTo(x, yTop, x + radius, yTop);
    this.ctx.lineTo(x + w - radius, yTop);
    this.ctx.quadraticCurveTo(x + w, yTop, x + w, yTop + radius);
    this.ctx.lineTo(x + w, yBottom);
    this.ctx.closePath();
    this.ctx.fillStyle = this.white();
    this.ctx.fill();
    // 渐变的暗面：圆角下面一截叠 16 层淡黑，越往下叠得越多（层和层之间没有缝）
    const start = yTop + radius;
    const layers = 14;
    const step = (yBottom - start) / layers;
    if (step <= 0) return;
    this.ctx.fillStyle = "rgba(0,0,0,0.04)";
    for (let index = 0; index < layers; index++) {
      this.ctx.fillRect(x, start + step * index, w, yBottom - start - step * index);
    }
  }

  /**
   * 风向箭头（导航箭头的形状，左半边亮、右半边灰一点，像设计稿的银色箭头）。
   * `angle` 是风吹来的方向（正北 0°、顺时针），箭头尖指向这个方向。
   */
  arrow(x: number, y: number, side: number, angle: number): void {
    const radians = rad(Number.isFinite(angle) ? angle : 45);
    const point = (px: number, py: number): LockPoint => ({
      x: x + (px * Math.cos(radians) - py * Math.sin(radians)) * side,
      y: y + (px * Math.sin(radians) + py * Math.cos(radians)) * side,
    });
    const tip = point(0, -0.5);
    const notch = point(0, 0.18);
    const leftWing = point(-0.38, 0.45);
    const rightWing = point(0.38, 0.45);
    this.polygon([tip, leftWing, notch], this.white());
    this.polygon([tip, rightWing, notch], this.white(0.72));
  }
}
