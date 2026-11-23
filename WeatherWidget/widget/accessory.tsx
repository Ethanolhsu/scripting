// 锁屏 / 待机的三种小组件。系统只给单色（图标和字都会被统一染色），所以这里不靠颜色说话，
// 只放图标和字，也不指定前景色。圆形放图标 + 气温，矩形放地名、气温和天气、最高最低，单行放一句话。
//
// 对应 RoamControl 的天气角标（一朵云加当前气温）：锁屏上的圆形就是那个角标。
// 点一下打开本脚本（widgetURL）；不写的话，点锁屏小组件只会打开 Scripting 的首页。
// 有预警时：单行换成预警短名、矩形的第三行换成预警（前面是按预警类型挑的图案）、圆形里的天气图标换成三角（通用的警告符号，
// 圆形里没有地方写字，用类型图案的话会和「现在在下雨」那种天气图标混在一起）。
// 锁屏是单色，预警的级别颜色画不出来，靠文字（「大风蓝色预警」）说。

import { AccessoryWidgetBackground, HStack, Image, Label, RoundedRectangle, Spacer, Text, VStack, ZStack, type VirtualNode } from "scripting";
import { weekdayOf, type AlertView, type Content, type DayView } from "../core/present";

export function AccessoryView({
  family,
  content,
  tapURL,
}: {
  family: "circular" | "rectangular" | "inline";
  content: Content;
  tapURL: string | undefined;
}) {
  if (content.kind === "empty") {
    if (family === "inline") {
      return (
        <Text lineLimit={1} widgetURL={tapURL}>
          {content.title}
        </Text>
      );
    }
    if (family === "circular") {
      return (
        <ZStack widgetURL={tapURL}>
          <AccessoryWidgetBackground />
          <Image systemName={content.symbol} font="title3" />
        </ZStack>
      );
    }
    return (
      <VStack alignment="leading" spacing={1} widgetURL={tapURL}>
        <Text font="headline" lineLimit={1} minScaleFactor={0.7}>
          {content.title}
        </Text>
        <Text font="caption2" lineLimit={1} minScaleFactor={0.7}>
          {content.lines[0] ?? ""}
        </Text>
      </VStack>
    );
  }

  const alert = content.alert;
  const warning = "exclamationmark.triangle.fill";

  if (family === "inline") {
    return (
      <Label
        title={alert !== null ? alert.text : content.inline}
        systemImage={alert !== null ? alert.symbol : content.condition.symbol}
        widgetURL={tapURL}
      />
    );
  }

  if (family === "rectangular") {
    return <RectangularRows content={content} alert={alert} tapURL={tapURL} />;
  }

  return (
    <ZStack widgetURL={tapURL}>
      <AccessoryWidgetBackground />
      <VStack spacing={1}>
        <Image systemName={alert !== null ? warning : content.condition.symbol} font="headline" />
        <Text font="caption" fontWeight="semibold" monospacedDigit lineLimit={1} minScaleFactor={0.6}>
          {content.temperature}
        </Text>
      </VStack>
    </ZStack>
  );
}

/**
 * 锁屏矩形：参考「锁屏天气组件」的三行布局——
 *   现在 [图标] 22°
 *   今天 [图标] 21° —— 27°
 *   明天 [图标] 21° —— 26°
 * 只有标签列和最低温列定宽（对齐横线起点），其余留弹性，免得整行被压缩缩字。
 * 图标统一用 semibold 字重渲染 SF Symbol，比参考脚本的 light 更粗。
 * 有预警时第三行让给预警；没有逐日数据（备用来源）时只画「现在」「今天」两行。
 */

/** 标签列宽：两个 16pt 汉字约 32pt + 4pt 到图标的间距。定宽，三行标签才对齐 */
const LABEL_WIDTH = 38;
/** 图标列宽：16pt 图标 + 5pt 到温度的间距。定宽，三行图标才落在同一 x（弹性间隔会把内容少的行推右） */
const ICON_WIDTH = 21;
/** 最低温列宽：「21°」在 17pt 下约 24pt，定宽让两行横线起点对齐 */
const LOW_WIDTH = 27;
/** 温度区间横线：长度超过 ~24pt 会开始挤字（锁屏矩形只有 ~150pt 宽） */
const DASH_LENGTH = 20;
const DASH_THICKNESS = 3;

function RectRow({ label, symbol, children }: { label: string; symbol: string; children: VirtualNode }) {
  return (
    <HStack spacing={0}>
      <Text font={16} fontWeight="semibold" frame={{ width: LABEL_WIDTH, alignment: "leading" }} lineLimit={1} minScaleFactor={0.85}>
        {label}
      </Text>
      <Image systemName={symbol} font={16} fontWeight="semibold" frame={{ width: ICON_WIDTH, alignment: "leading" }} />
      {children}
      <Spacer minLength={0} />
    </HStack>
  );
}

/** 最低温 — 横线 — 最高温：间距固定 2pt，最低温列定宽，两行横线起点对齐 */
function RangeCells({ low, high }: { low: string; high: string }) {
  return (
    <HStack spacing={2}>
      <Text font={17} fontWeight="bold" monospacedDigit frame={{ width: LOW_WIDTH, alignment: "leading" }} lineLimit={1} minScaleFactor={0.85}>
        {low}
      </Text>
      <RoundedRectangle cornerRadius={DASH_THICKNESS / 2} fill="label" frame={{ width: DASH_LENGTH, height: DASH_THICKNESS }} />
      <Text font={17} fontWeight="bold" monospacedDigit lineLimit={1} minScaleFactor={0.85}>
        {high}
      </Text>
    </HStack>
  );
}

function RectangularRows({ content, alert, tapURL }: { content: Extract<Content, { kind: "weather" }>; alert: AlertView | null; tapURL: string | undefined }) {
  const days = content.detail?.days ?? [];
  // 第三行：有预警先说预警；否则明天（没有明天就用后天，再没有就只画两行）
  const third: DayView | null = days[0] ?? days[1] ?? null;
  const thirdLabel = third === null ? "" : third.weekday === "明天" ? "明天" : weekdayOf(third.key);

  return (
    <VStack alignment="leading" spacing={2} widgetURL={tapURL}>
      <RectRow label="现在" symbol={content.condition.symbol}>
        <Text font={17} fontWeight="bold" monospacedDigit lineLimit={1} minScaleFactor={0.85}>
          {content.temperature}
        </Text>
      </RectRow>
      <RectRow label="今天" symbol={content.condition.symbol}>
        <RangeCells low={content.todayLow} high={content.todayHigh} />
      </RectRow>
      {alert !== null ? (
        <RectRow label="预警" symbol={alert.symbol}>
          <Text font={13} fontWeight="semibold" lineLimit={1} minScaleFactor={0.7}>
            {alert.text}
          </Text>
        </RectRow>
      ) : third !== null ? (
        <RectRow label={thirdLabel} symbol={third.symbol}>
          <RangeCells low={third.low} high={third.high} />
        </RectRow>
      ) : null}
    </VStack>
  );
}
