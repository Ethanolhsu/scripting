// 各种尺寸下用多大的字、留多宽的边。
// 小组件的实际点数每台设备都不一样（小号 148~170、中号 321~364 宽、大号 324~382 高），
// 所以所有数都是「参考尺寸上的值 × 缩放比」，不写死某一台机器。
// 内缩也由我们自己定，不指望系统给的内容边距（见 widget/view.tsx）。

import type { Board, Hex, Style } from "./store"

export type Family = "small" | "medium" | "large"

const REFERENCE: Record<Family, [number, number]> = {
  small: [158, 158],
  medium: [338, 158],
  large: [338, 354],
}

/** 内容离组件四边的距离（参考尺寸上的值） */
const INSET: Record<Family, number> = { small: 14, medium: 16, large: 16 }

export function familyOf(widgetFamily: string, width: number, height: number): Family {
  switch (widgetFamily) {
    case "systemSmall":
      return "small"
    case "systemMedium":
      return "medium"
    case "systemLarge":
      return "large"
    default:
      // 拿不到 family（预览、超大尺寸）就按宽高猜
      return width > height * 1.5 ? "medium" : height > 220 ? "large" : "small"
  }
}

export type Metrics = {
  /** 相对参考尺寸的缩放比 */
  scale: number
  /** 内容四边内缩 */
  inset: number
  /** 榜单名字号 */
  title: number
  /** 正文与序号字号 */
  content: number
  /** 刷新时间那一行的字号 */
  meta: number
  /** 标题行和条目之间、条目之间的间距 */
  gap: number
  /** 序号那一列的宽度（两位数也不让标题错位） */
  indexWidth: number
  /** 榜单图标边长 */
  icon: number
  /** 竖排最多几条 */
  count: number
}

const MIN_FONT = 8

function round(value: number): number {
  return Math.round(value * 2) / 2
}

function usable(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function metricsFor(family: Family, width: number, height: number, style: Style): Metrics {
  const [refWidth, refHeight] = REFERENCE[family]
  const scale = Math.min(2.4, Math.max(0.7, Math.min(usable(width, refWidth) / refWidth, usable(height, refHeight) / refHeight)))

  const count = family === "small" ? style.smallCount : family === "medium" ? style.mediumCount : style.largeCount
  // 小号整体小半号，大号大一点；设置里的数是中号的基准
  const titleBase = family === "small" ? style.titleSize - 2 : family === "large" ? style.titleSize + 1 : style.titleSize
  const contentBase = family === "small" ? style.contentSize - 1 : style.contentSize
  const gapBase = family === "small" ? Math.min(style.lineSpacing, 4) : style.lineSpacing

  const content = Math.max(MIN_FONT, round(contentBase * scale))
  return {
    scale,
    inset: round(INSET[family] * scale),
    title: Math.max(9, round(titleBase * scale)),
    content,
    meta: Math.max(7, round(9 * scale)),
    gap: round(gapBase * scale * 2) / 2,
    indexWidth: Math.max(16, round(content * 1.75)),
    icon: round((family === "small" ? 17 : 18) * scale),
    count: Math.max(1, Math.round(count)),
  }
}

/** 时间显示成 21:07 */
export function formatTime(date: Date): string {
  return `${date.getHours()}`.padStart(2, "0") + ":" + `${date.getMinutes()}`.padStart(2, "0")
}

export function simplify(text: string): string {
  return `${text ?? ""}`.toLowerCase().replace(/[\s‧·•]/g, "")
}

/**
 * 这次显示哪个榜单：Parameter 里填了榜单名（或 ID）就固定显示它，否则按 cursor 顺序轮换。
 * 返回 pinned 为 true 时调用方不要推进 cursor。
 */
export function pickBoard(boards: Board[], cursor: number, parameter: string): { board: Board; pinned: boolean } {
  const list = boards.filter((board) => board.id !== "")
  const keyword = simplify(parameter)
  if (keyword !== "") {
    const pinned = list.find((board) => simplify(board.name).includes(keyword) || board.id === parameter)
    if (pinned) return { board: pinned, pinned: true }
  }
  if (list.length === 0) return { board: { id: "KqndgxeLl9", name: "微博 ‧ 热搜榜", icon: "" }, pinned: false }
  const index = ((cursor % list.length) + list.length) % list.length
  return { board: list[index], pinned: false }
}

/** 相对亮度（0 黑 ~ 1 白），用来决定背景上该配白字还是黑字 */
function luminance(hex: Hex): number {
  const value = hex.replace("#", "")
  const channels = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255)
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** 背景上的主文字色：浅底配近黑，深底配白 */
export function inkFor(background: Hex): Hex {
  return luminance(background) > 0.5 ? "#1C1C1E" : "#FFFFFF"
}

/** 背景上的次要文字色（序号、时间） */
export function secondaryInkFor(background: Hex): Hex {
  return luminance(background) > 0.5 ? "#5B5B60" : "#AEAEB2"
}
