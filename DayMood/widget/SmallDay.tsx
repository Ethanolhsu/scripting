// 2×2 小号小组件的版面：
//   2026.12.01
//   星期二  [国庆节·放假]
//   ┌──────────────┐
//   │  手绘线稿 + 牌子 │
//   └──────────────┘
//
// 背景透明，日期/星期/牌子文字用用户选的颜色；插画是黑色线稿+白色填充，深色壁纸上也能看清。

import { HStack, Image, RoundedRectangle, Text, VStack, ZStack, type Color } from "scripting";
import { artFor, type DayState } from "../core/dayState";
import { isLightColor, signBackground } from "../core/settings";

function Sign({ text, color }: { text: string; color: Color }) {
  const background = signBackground(color);
  return (
    <ZStack frame={{ width: 50, height: 23 }}>
      <RoundedRectangle
        cornerRadius={3}
        fill={background as Color}
        stroke={{ shapeStyle: color as Color, strokeStyle: { lineWidth: 1 } }}
      />
      <Text
        font={9.5}
        fontWeight="bold"
        foregroundStyle={color}
        lineLimit={1}
        minScaleFactor={0.6}
        padding={{ horizontal: 2 }}
      >
        {text}
      </Text>
    </ZStack>
  );
}

function WeekdayLine({ state, color }: { state: DayState; color: Color }) {
  return (
    <HStack spacing={5} alignment="center">
      <Text font={12} fontWeight="bold" foregroundStyle={color} lineLimit={1}>
        {state.weekday}
      </Text>
      {state.tag !== "" ? (
        <Text font={8.5} fontWeight="semibold" foregroundStyle={color} opacity={0.82} lineLimit={1} minScaleFactor={0.8}>
          {state.tag}
        </Text>
      ) : null}
    </HStack>
  );
}

export function SmallDay({ state, color, tapURL }: { state: DayState; color: Color; tapURL?: string }) {
  const art = artFor(state.art);
  return (
    <ZStack
      frame={{ width: 158, height: 158 }}
      alignment="topLeading"
      widgetURL={tapURL}
    >
      <VStack alignment="leading" spacing={1} padding={{ top: 11, leading: 14, trailing: 10, bottom: 6 }}>
        <Text font={10} fontWeight="medium" monospacedDigit foregroundStyle={color} lineLimit={1}>
          {state.date}
        </Text>
        <WeekdayLine state={state} color={color} />
        <ZStack frame={{ width: 132, height: 112 }} alignment="topLeading">
          {art !== null ? (
            <Image
              image={art}
              resizable
              interpolation="high"
              antialiased
              frame={{ width: 108, height: 108 }}
              position={{ x: 54, y: 58 }}
            />
          ) : (
            <Image
              systemName="sun.max.fill"
              font={64}
              foregroundStyle={color}
              opacity={0.18}
              position={{ x: 54, y: 58 }}
            />
          )}
          <ZStack position={{ x: 104, y: 12 }}>
            <Sign text={state.phrase} color={color} />
          </ZStack>
        </ZStack>
      </VStack>
    </ZStack>
  );
}
