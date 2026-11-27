// 锁屏组件的坐标换算：设计稿是圆形 72×72、矩形 160×72，画的时候按组件实际大小等比缩放。
//
// 圆形横竖同等缩放（弧线、圆圈不变形），整块在设计稿里居中；矩形位置横竖分别缩放（铺满左右），
// 字号、线宽按高度缩放——iPhone 上矩形差不多就是 160×72，所以基本是 1:1。
//
// 坐标一律先写设计稿的数（X/Y 换算成组件上的点），字号写设计稿的字号（`unit` 乘一下）。

import type { LockFamilyKey } from "../../core/lock";

export type LockDesign = {
  /** 组件的实际大小（点） */
  readonly width: number;
  readonly height: number;
  /** 设计稿横向、纵向的缩放比 */
  readonly sx: number;
  readonly sy: number;
  /** 字号、线宽用的缩放比 */
  readonly unit: number;
  /** 设计稿的 x、y → 组件上的点 */
  X: (value: number) => number;
  Y: (value: number) => number;
};

/** 设计稿尺寸 */
export const CIRCLE_DESIGN = { width: 72, height: 72 } as const;
export const RECT_DESIGN = { width: 160, height: 72 } as const;

function usable(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** 圆形：按短边等比缩放，整块居中 */
export function circleDesign(width: number, height: number): LockDesign {
  const realWidth = usable(width, 72);
  const realHeight = usable(height, 72);
  const unit = Math.min(realWidth / CIRCLE_DESIGN.width, realHeight / CIRCLE_DESIGN.height);
  const left = (realWidth - CIRCLE_DESIGN.width * unit) / 2;
  const top = (realHeight - CIRCLE_DESIGN.height * unit) / 2;
  return {
    width: realWidth,
    height: realHeight,
    sx: unit,
    sy: unit,
    unit,
    X: (value) => left + value * unit,
    Y: (value) => top + value * unit,
  };
}

/**
 * 矩形：横向铺满 160；纵向按整块组件的 76 高排（系统给的是减掉上下边距后的内容高度，
 * 一般只有 72，原版也是按 76 排、画进上下各 2pt 的边距里），字号跟着 76 走。
 * 横向不动：系统左右边距各 7pt，原版的 160 宽画面基本就落在内容区里。
 */
export function rectDesign(width: number, height: number): LockDesign {
  const realWidth = usable(width, 160);
  const realHeight = usable(height, 72);
  const fullHeight = Math.max(realHeight, 76);
  const sx = realWidth / RECT_DESIGN.width;
  const sy = fullHeight / RECT_DESIGN.height;
  const top = (realHeight - fullHeight) / 2;
  return {
    width: realWidth,
    height: realHeight,
    sx,
    sy,
    unit: Math.min(sx, sy),
    X: (value) => value * sx,
    Y: (value) => top + value * sy,
  };
}

export function designOf(family: LockFamilyKey, width: number, height: number): LockDesign {
  return family === "circle" ? circleDesign(width, height) : rectDesign(width, height);
}
