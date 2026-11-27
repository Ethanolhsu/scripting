// 今日热榜小组件的入口：读设置 → 选榜单 → 取数据（缓存新就不联网）→ 算版面 → 画出来 → 约好下次重画。
//
// 点一下组件：打开当前这个榜单在 tophub 上的网页（和原版一致），不是打开脚本。
// 小组件是一次性渲染：`Widget.present` 一返回，这段上下文就没了，所以要在它之前把该算的都算完。
// 取数失败不空白：先退回缓存（在 core/tophub.ts 里），再不行就画一张写着原因的小卡。

import { Text, Widget, VStack, ZStack } from "scripting"
import { familyOf, metricsFor, pickBoard } from "./core/layout"
import { loadSettings, saveSettings, type BoardData } from "./core/store"
import { loadBoard, TOPHUB } from "./core/tophub"
import { WidgetView } from "./widget/view"

const FALLBACK: Record<string, { width: number; height: number }> = {
  small: { width: 158, height: 158 },
  medium: { width: 338, height: 158 },
  large: { width: 338, height: 354 },
}

function displaySize(layout: "small" | "medium" | "large"): { width: number; height: number } {
  const size = Widget.displaySize
  const width = size !== undefined && Number.isFinite(size.width) && size.width > 0 ? size.width : FALLBACK[layout].width
  const height = size !== undefined && Number.isFinite(size.height) && size.height > 0 ? size.height : FALLBACK[layout].height
  return { width, height }
}

async function run(): Promise<void> {
  const family = Widget.family ?? "systemMedium"
  const guess: "small" | "medium" | "large" =
    family === "systemSmall" ? "small" : family === "systemLarge" ? "large" : "medium"
  const { width, height } = displaySize(guess)

  const settings = loadSettings()
  const layout = familyOf(family, width, height)
  const m = metricsFor(layout, width, height, settings.style)

  const { board, pinned } = pickBoard(settings.boards, settings.cursor, `${Widget.parameter ?? ""}`)
  if (!pinned && settings.boards.length > 0) {
    // 每次刷新按顺序换下一个榜单；几个尺寸共用同一个游标，和原版一样
    settings.cursor = (settings.cursor + 1) % settings.boards.length
    saveSettings(settings)
  }

  let data: BoardData | null = null
  try {
    data = await loadBoard(board.id)
  } catch (error) {
    console.log("热榜取数失败", error)
  }

  Widget.present(
    <WidgetView
      family={family}
      width={width}
      height={height}
      m={m}
      board={board}
      data={data}
      style={settings.style}
      tapURL={`${TOPHUB}/n/${board.id}`}
    />,
    { policy: "after", date: new Date(Date.now() + 60 * 60 * 1000) },
  )
}

run().catch((error: unknown) => {
  Widget.present(
    <ZStack widgetBackground="#151517" frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <VStack padding={16} alignment="leading" spacing={6}>
        <Text font={14} fontWeight="semibold" foregroundStyle="#FFFFFF" lineLimit={2}>
          {"今日热榜出错了\n" + String(error).slice(0, 100)}
        </Text>
      </VStack>
    </ZStack>,
  )
})
