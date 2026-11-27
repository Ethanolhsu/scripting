// 今日热榜 · 小组件（Scripting App）
// 对应原 Scriptable 版的 render()：榜单图标 + 榜单名 + 刷新时间，下面按顺序列热榜，前三名序号红色斜体
// 组件入口文件必须叫 widget.tsx；点击组件会打开当前榜单的网页

import { HStack, Image, Spacer, Text, VStack, Widget } from "scripting"
import {
  DEFAULT_STYLE,
  formatTime,
  loadBoardData,
  loadLogoPath,
  loadSettings,
  pickBoard,
  saveSettings,
  simplifyName,
  TOPHUB,
  type Board,
  type BoardData,
  type HotItem,
  type Style,
} from "./shared"

/** 不同尺寸下的条数与字号（条数可在设置页里改） */
function layoutFor(family: string, style: Style) {
  if (family === "systemSmall") {
    return {
      count: Math.max(1, Math.round(Number(style.smallCount) || 5)),
      titleSize: Math.max(10, Math.round(Number(style.titleFontSize) - 2)),
      compact: true,
    }
  }
  if (family === "systemLarge") {
    return {
      count: Math.max(1, Math.round(Number(style.largeCount) || 12)),
      titleSize: Math.max(11, Math.round(Number(style.titleFontSize))),
      compact: false,
    }
  }
  return {
    count: Math.max(1, Math.round(Number(style.mediumCount) || 5)),
    titleSize: Math.max(11, Math.round(Number(style.titleFontSize))),
    compact: false,
  }
}

/** 颜色：设置里填了 #RRGGBB 就固定，留空用系统语义色（自动适配浅色/深色） */
function textColor(custom: string, fallback: string) {
  const value = `${custom ?? ""}`.trim()
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function Logo({ path, size }: { path?: string; size: number }) {
  if (!path) return null
  return <Image filePath={path} resizable frame={{ width: size, height: size }} cornerRadius={5} />
}

function Row({
  item,
  index,
  contentSize,
  indexWidth,
  titleColor,
  contentColor,
  hotColor,
}: {
  item: HotItem
  index: number
  contentSize: number
  indexWidth: number
  titleColor: any
  contentColor: any
  hotColor: any
}) {
  const top = index < 3
  return (
    <HStack alignment="center" spacing={2}>
      <Text
        font={contentSize}
        italic={top}
        lineLimit={1}
        foregroundStyle={top ? hotColor : titleColor}
        frame={{ width: indexWidth, alignment: "leading" }}
      >
        {`${index + 1}.`}
      </Text>
      <Text
        font={contentSize}
        lineLimit={1}
        truncationMode="tail"
        foregroundStyle={contentColor}
        layoutPriority={1}
      >
        {item.title}
      </Text>
    </HStack>
  )
}

function HotWidgetView({
  board,
  data,
  style,
  family,
}: {
  board: Board
  data: BoardData | null
  style: Style
  family: string
}) {
  const layout = layoutFor(family, style)
  const contentSize = Math.max(9, Number(style.contentFontSize) || 13)
  const lineSpacing = Math.max(0, Number(style.lineSpacing) || 0)
  const showTitle = style.showTitle !== false
  const showTime = family !== "systemSmall" && style.showRefresh !== false

  const titleColor = textColor(style.titleColor, "primary")
  const contentColor = textColor(style.contentColor, "primary")
  const hotColor = textColor(style.hotColor, "#EF233C")
  const refreshColor = "secondary"

  const boardTitle = (data?.title || board?.name || "今日热榜").trim()
  const items = (data?.items ?? []).slice(0, layout.count)
  const indexWidth = Math.max(16, Math.round(contentSize * 1.4))
  const pageUrl = `${TOPHUB}/n/${board?.id ?? ""}`

  if (!data || data.items.length === 0) {
    return (
      <VStack alignment="leading" spacing={6} widgetURL={pageUrl}>
        <Text font={layout.titleSize} fontWeight="semibold" lineLimit={1} foregroundStyle={titleColor}>
          {boardTitle}
        </Text>
        <Text font={contentSize} foregroundStyle={contentColor}>
          暂无数据，检查网络后刷新
        </Text>
        <Spacer />
      </VStack>
    )
  }

  return (
    <VStack alignment="leading" spacing={lineSpacing} widgetURL={pageUrl}>
      {showTitle || showTime ? (
        <HStack alignment="center" spacing={6} frame={{ height: 24 }}>
          {showTitle ? <Logo path={(data as any).__logoPath} size={Math.max(16, layout.titleSize + 4)} /> : null}
          {showTitle ? (
            <Text font={layout.titleSize} fontWeight="semibold" lineLimit={1} foregroundStyle={titleColor}>
              {boardTitle}
            </Text>
          ) : null}
          <Spacer />
          {showTime ? (
            <HStack alignment="center" spacing={2}>
              <Image systemName="goforward" frame={{ width: 11, height: 11 }} foregroundStyle={refreshColor} />
              <Text font={Math.max(9, Math.round(contentSize * 0.75))} foregroundStyle={refreshColor}>
                {formatTime(new Date())}
              </Text>
            </HStack>
          ) : null}
        </HStack>
      ) : null}

      {items.map((item, index) => (
        <Row
          key={`${index}-${item.title}`}
          item={item}
          index={index}
          contentSize={contentSize}
          indexWidth={indexWidth}
          titleColor={titleColor}
          contentColor={contentColor}
          hotColor={hotColor}
        />
      ))}
      <Spacer />
    </VStack>
  )
}

async function main() {
  const family = Widget.family ?? "systemMedium"
  const parameter = `${Widget.parameter ?? ""}`
  const settings = loadSettings()
  const style = { ...DEFAULT_STYLE, ...settings.style }

  const list = settings.boards.filter((b) => b?.id)
  const keyword = simplifyName(parameter)
  const pinned = keyword ? list.find((b) => simplifyName(b.name).includes(keyword) || b.id === parameter) : null

  let cursor = settings.cursor
  if (!pinned && list.length > 0) {
    // 每次刷新按顺序轮换榜单，和小尺寸/中尺寸/大尺寸共用同一个游标
    cursor = (cursor + 1) % list.length
    settings.cursor = cursor
    saveSettings(settings)
  }
  const board = pinned ?? pickBoard(list, pinned ? 0 : cursor, "")

  let data: BoardData | null = null
  try {
    data = await loadBoardData(board.id)
    const logoPath = await loadLogoPath(board.icon || data.logo)
    if (logoPath) (data as any).__logoPath = logoPath
  } catch (error) {
    console.log("加载热榜失败", error)
  }

  const view = <HotWidgetView board={board} data={data} style={style} family={family} />
  try {
    Widget.present(view, { policy: "after", date: new Date(Date.now() + 60 * 60 * 1000) })
  } catch (error) {
    // 个别版本对刷新策略参数不兼容时，退回默认刷新
    Widget.present(view)
  }
}

main().catch((error) => {
  console.log("组件渲染失败", error)
  Widget.present(
    <VStack alignment="leading" spacing={6}>
      <Text font={15} fontWeight="semibold">
        今日热榜
      </Text>
      <Text font={13} foregroundStyle="secondary">
        组件加载失败，打开脚本查看控制台
      </Text>
      <Spacer />
    </VStack>,
  )
})
