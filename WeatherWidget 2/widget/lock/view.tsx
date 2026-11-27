// 锁屏款式里共用的小零件：按设计稿坐标摆的文字、SF 符号，以及铺满整块的 Canvas 图形层。
//
// 为什么文字用真的 Text、图形才用 Canvas：锁屏是单色，字的分量（semibold、等宽数字、按框缩小）要靠系统字体，
// 弧线、流线、柱子这些形状 Canvas 画得准。两者叠在同一个 ZStack 里，位置都用 `position` 按设计稿的坐标算。

import { Canvas, HStack, Image, Text, type VirtualNode } from "scripting";
import type { LockDesign } from "./design";
import { LockPen } from "./pen";

export type LockAlign = "leading" | "center" | "trailing";

/** 锁屏上的白字；alpha 用来分主次（次要的字 0.85 左右） */
export function LockText({
  d,
  text,
  x,
  y,
  size,
  weight = "medium",
  alpha = 1,
  align = "center",
  maxWidth,
}: {
  d: LockDesign;
  text: string;
  x: number;
  y: number;
  size: number;
  weight?: "regular" | "medium" | "semibold" | "bold";
  alpha?: number;
  align?: LockAlign;
  /** 设计稿单位的最宽：超出时按比例缩字（和设计稿里 maxWidth 的意思一样） */
  maxWidth?: number;
}) {
  const font = Math.max(size * d.unit, 1);
  // 居中时给一块足够宽的透明框，左右对齐时框不需要太宽（只是对齐的参照）
  const width = (maxWidth ?? (align === "center" ? 100 : 90)) * d.sx;
  const centerX = align === "center" ? d.X(x) : align === "trailing" ? d.X(x) - width / 2 : d.X(x) + width / 2;
  return (
    <Text
      font={font}
      fontWeight={weight}
      lineLimit={1}
      minScaleFactor={0.55}
      frame={{ width, height: font * 1.45, alignment: align }}
      position={{ x: centerX, y: d.Y(y) }}
      foregroundStyle={`rgba(255,255,255,${alpha})`}
    >
      {text}
    </Text>
  );
}

/** 锁屏上的 SF 符号（按设计稿的字号缩），白色 */
export function LockIcon({
  d,
  name,
  x,
  y,
  side,
  alpha = 1,
}: {
  d: LockDesign;
  name: string;
  x: number;
  y: number;
  /** 图标的边长（设计稿单位） */
  side: number;
  alpha?: number;
}) {
  return (
    <Image
      systemName={name}
      font={Math.max(side * d.unit, 1)}
      position={{ x: d.X(x), y: d.Y(y) }}
      foregroundStyle={`rgba(255,255,255,${alpha})`}
    />
  );
}

/** 图形层：铺满整个设计稿，画弧线、流线、柱子、圆点 */
export function LockCanvas({ d, draw }: { d: LockDesign; draw: (pen: LockPen) => void }) {
  return (
    <Canvas
      frame={{ width: d.width, height: d.height }}
      // 默认不透明（底色未定义），锁屏上得让它透过去，只留画出来的线和点
      opaque={false}
      draw={(ctx) => draw(new LockPen(ctx as never, d))}
    />
  );
}

/**
 * 一行并排的大数字和小单位（「5 级」「64 %」）：两边底边大致对齐，整组以设计稿的 (x, y) 为中心。
 * 用真 HStack 就不用自己估字宽，锁屏上中文字宽和估出来的总有出入。
 */
export function LockNumberUnit({
  d,
  x,
  y,
  number,
  unit,
  numberSize,
  unitSize,
}: {
  d: LockDesign;
  x: number;
  y: number;
  number: string;
  unit: string;
  numberSize: number;
  unitSize: number;
}) {
  return (
    <HStack alignment="lastTextBaseline" spacing={1.5 * d.unit} position={{ x: d.X(x), y: d.Y(y) }}>
      <Text font={Math.max(numberSize * d.unit, 1)} fontWeight="semibold" monospacedDigit lineLimit={1} foregroundStyle="rgba(255,255,255,1)">
        {number}
      </Text>
      {unit === "" ? null : (
        <Text font={Math.max(unitSize * d.unit, 1)} fontWeight="medium" lineLimit={1} foregroundStyle="rgba(255,255,255,1)">
          {unit}
        </Text>
      )}
    </HStack>
  );
}

/** 大数字和小单位从设计稿的 (x, y) 往右排（「64%」贴在湿度那一列的左边缘）；框宽 70，不估字宽 */
export function LockLongNumber({
  d,
  x,
  y,
  number,
  unit,
  numberSize,
  unitSize,
}: {
  d: LockDesign;
  x: number;
  y: number;
  number: string;
  unit: string;
  numberSize: number;
  unitSize: number;
}) {
  const width = 70 * d.sx;
  return (
    <HStack alignment="lastTextBaseline" spacing={1.5 * d.unit} frame={{ width, alignment: "leading" }} position={{ x: d.X(x) + width / 2, y: d.Y(y) }}>
      <Text font={Math.max(numberSize * d.unit, 1)} fontWeight="semibold" monospacedDigit lineLimit={1} foregroundStyle="rgba(255,255,255,1)">
        {number}
      </Text>
      {unit === "" ? null : (
        <Text font={Math.max(unitSize * d.unit, 1)} fontWeight="medium" lineLimit={1} foregroundStyle="rgba(255,255,255,1)">
          {unit}
        </Text>
      )}
    </HStack>
  );
}
