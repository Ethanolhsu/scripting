// 小组件的根视图：按 `Widget.family` 挑版面，背景和字色都按「浅色 / 深色」各给一套。
//
// 背景色由设置里的 backgroundLight / backgroundDark 决定，交给 DynamicShapeStyle（{ light, dark }），
// 系统在浅色模式下取 light、深色模式下取 dark，不需要我们判断当前是哪种模式。
// 字色不让用户单独配：按背景的亮度自动选（浅底近黑、深底纯白），改浅色背景也不会白字看不清。
//
// 根视图撑成 `Widget.displaySize` 的满尺寸、内缩自己留：背景才铺得到边。

import { HStack, Image, Spacer, Text, VStack, ZStack } from "scripting"
import { formatTime, inkFor, secondaryInkFor, type Metrics } from "../core/layout"
import type { BoardData, Hex, Style } from "../core/store"

/** 浅色/深色两套值 */
type Dynamic = { light: Hex; dark: Hex }

function Row({
  title,
  index,
  m,
  hotColor,
  ink,
  secondary,
}: {
  title: string
  index: number
  m: Metrics
  hotColor: Hex
  ink: Dynamic
  secondary: Dynamic
}) {
  const top = index < 3
  return (
    <HStack alignment="center" spacing={2}>
      <Text
        font={m.content}
        fontWeight={top ? "bold" : "regular"}
        foregroundStyle={top ? hotColor : secondary}
        lineLimit={1}
        frame={{ width: m.indexWidth, alignment: "leading" }}
      >
        {`${index + 1}.`}
      </Text>
      <Text
        font={m.content}
        foregroundStyle={ink}
        lineLimit={1}
        truncationMode="tail"
        minScaleFactor={0.8}
        layoutPriority={1}
      >
        {title}
      </Text>
    </HStack>
  )
}

function EmptyCard({
  title,
  lines,
  m,
  ink,
  secondary,
}: {
  title: string
  lines: string[]
  m: Metrics
  ink: Dynamic
  secondary: Dynamic
}) {
  return (
    <VStack alignment="leading" spacing={m.gap}>
      <Spacer />
      <Image
        systemName="exclamationmark.arrow.triangle.2.circlepath"
        font={m.title * 1.6}
        foregroundStyle={secondary}
      />
      <Text font={m.title} fontWeight="semibold" foregroundStyle={ink} lineLimit={1}>
        {title}
      </Text>
      {lines.map((line) => (
        <Text key={line} font={m.content} foregroundStyle={secondary} lineLimit={1} minScaleFactor={0.7}>
          {line}
        </Text>
      ))}
      <Spacer />
    </VStack>
  )
}

export function WidgetView({
  family,
  width,
  height,
  m,
  board,
  data,
  style,
  tapURL,
}: {
  family: string
  width: number
  height: number
  m: Metrics
  board: { name: string; icon: string }
  data: BoardData | null
  style: Style
  tapURL: string | undefined
}) {
  const ink: Dynamic = { light: inkFor(style.backgroundLight), dark: inkFor(style.backgroundDark) }
  const secondary: Dynamic = {
    light: secondaryInkFor(style.backgroundLight),
    dark: secondaryInkFor(style.backgroundDark),
  }

  const items = data === null ? [] : data.items.slice(0, m.count)
  const boardTitle = (data?.title || board.name || "今日热榜").trim()
  const showTime = family !== "systemSmall" && style.showRefresh
  const showTitle = style.showTitle

  const inner =
    items.length === 0 ? (
      <EmptyCard
        title={boardTitle === "" ? "今日热榜" : boardTitle}
        lines={["暂时取不到数据", "点一下打开热榜网页"]}
        m={m}
        ink={ink}
        secondary={secondary}
      />
    ) : (
      <VStack alignment="leading" spacing={0}>
        {showTitle || showTime ? (
          <HStack alignment="center" spacing={m.gap * 1.5} frame={{ height: m.title + m.gap * 2 }}>
            {showTitle && board.icon !== "" ? (
              <Image imageUrl={board.icon} resizable={true} frame={{ width: m.icon, height: m.icon }} />
            ) : null}
            {showTitle ? (
              <Text
                font={m.title}
                fontWeight="semibold"
                foregroundStyle={ink}
                lineLimit={1}
                minScaleFactor={0.6}
                layoutPriority={1}
              >
                {boardTitle}
              </Text>
            ) : null}
            <Spacer />
            {showTime ? (
              <HStack alignment="center" spacing={2}>
                <Image systemName="arrow.clockwise" font={m.meta} foregroundStyle={secondary} />
                <Text font={m.meta} foregroundStyle={secondary} lineLimit={1}>
                  {formatTime(new Date())}
                </Text>
              </HStack>
            ) : null}
          </HStack>
        ) : null}

        <VStack alignment="leading" spacing={m.gap}>
          {items.map((item, index) => (
            <Row
              key={`${index}-${item.title}`}
              title={item.title}
              index={index}
              m={m}
              hotColor={style.hotColor}
              ink={ink}
              secondary={secondary}
            />
          ))}
        </VStack>
        <Spacer />
      </VStack>
    )

  return (
    <ZStack
      frame={{ width, height }}
      widgetBackground={{ light: style.backgroundLight, dark: style.backgroundDark }}
      widgetURL={tapURL}
    >
      <VStack
        alignment="leading"
        padding={m.inset}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
      >
        {inner}
      </VStack>
    </ZStack>
  )
}
