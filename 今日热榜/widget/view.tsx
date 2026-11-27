// 小组件的根视图：按 `Widget.family` 挑版面，套背景和「点一下打开本脚本」。
//
// 根视图撑成 `Widget.displaySize` 的满尺寸、内缩自己留：系统会不会另留一圈内容边距、背景画在哪，
// 文档都没写死，这样不管哪种情况背景都铺到边，内容离边缘多远只由我们的 inset 决定。
// 配色锁成深色：背景是我们自己的深色卡，字就一直是白的，不跟着系统亮暗变。

import { HStack, Image, Spacer, Text, VStack, ZStack } from "scripting"
import { formatTime, type Metrics } from "../core/layout"
import type { BoardData, Hex, Style } from "../core/store"

const TEXT = "#FFFFFF"
const TEXT_2 = "#9B9BA1"

function Row({
  title,
  index,
  m,
  hotColor,
}: {
  title: string
  index: number
  m: Metrics
  hotColor: Hex
}) {
  const top = index < 3
  return (
    <HStack alignment="center" spacing={2}>
      <Text
        font={m.content}
        fontWeight={top ? "bold" : "regular"}
        foregroundStyle={top ? hotColor : TEXT_2}
        lineLimit={1}
        frame={{ width: m.indexWidth, alignment: "leading" }}
      >
        {`${index + 1}.`}
      </Text>
      <Text
        font={m.content}
        foregroundStyle={TEXT}
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

function EmptyCard({ title, lines, m }: { title: string; lines: string[]; m: Metrics }) {
  return (
    <VStack alignment="leading" spacing={m.gap}>
      <Spacer />
      <Image systemName="exclamationmark.arrow.triangle.2.circlepath" font={m.title * 1.6} foregroundStyle={TEXT_2} />
      <Text font={m.title} fontWeight="semibold" foregroundStyle={TEXT} lineLimit={1}>
        {title}
      </Text>
      {lines.map((line) => (
        <Text key={line} font={m.content} foregroundStyle={TEXT_2} lineLimit={1} minScaleFactor={0.7}>
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
  const items = data === null ? [] : data.items.slice(0, m.count)
  const boardTitle = (data?.title || board.name || "今日热榜").trim()
  const showTime = family !== "systemSmall" && style.showRefresh
  const showTitle = style.showTitle

  const inner =
    items.length === 0 ? (
      <EmptyCard
        title={boardTitle === "" ? "今日热榜" : boardTitle}
        lines={["暂时取不到数据", "点一下打开脚本，去设置里刷新"]}
        m={m}
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
                foregroundStyle={TEXT}
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
                <Image systemName="arrow.clockwise" font={m.meta} foregroundStyle={TEXT_2} />
                <Text font={m.meta} foregroundStyle={TEXT_2} lineLimit={1}>
                  {formatTime(new Date())}
                </Text>
              </HStack>
            ) : null}
          </HStack>
        ) : null}

        <VStack alignment="leading" spacing={m.gap}>
          {items.map((item, index) => (
            <Row key={`${index}-${item.title}`} title={item.title} index={index} m={m} hotColor={style.hotColor} />
          ))}
        </VStack>
        <Spacer />
      </VStack>
    )

  return (
    <ZStack
      frame={{ width, height }}
      widgetBackground={style.background}
      widgetURL={tapURL}
      environments={{ colorScheme: "dark" }}
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
