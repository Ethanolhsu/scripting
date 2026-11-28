// 2×2 小号小组件的版面，往 Noritake 那种“大量留白 + 一条线画到底”的构图上靠：
//   2026.12.01          [自愿上班]
//   星期二
//   ┌────────────┐
//   │  极简线稿   │
//   └────────────┘
//
// 背景完全透明，日期/星期/牌子文字用用户选的颜色；插画是黑色线稿 + 白色填充，
// 深色壁纸上也能看清。牌子放在右上角，不再压住人物。

import { HStack, Image, RoundedRectangle, Spacer, Text, VStack, ZStack, type Color } from "scripting";
import { artFor, type DayState } from "../core/dayState";
import { signBackground } from "../core/settings";

function Sign({ text, color }: { text: string; color: Color }) {
  return (
    <ZStack frame={{ width: 50, height: 23 }}>
      <RoundedRectangle
        cornerRadius={3}
        fill={signBackground(color) as Color}
        stroke={{ shapeStyle: color, strokeStyle: { lineWidth: 1 } }}
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

export function SmallDay({ state, color, tapURL }: { state: DayState; color: Color; tapURL?: string }) {
  const art = artFor(state.art);
  return (
    <ZStack frame={{ width: 158, height: 158 }} alignment="topLeading" widgetURL={tapURL}>
      <VStack alignment="leading" spacing={1} padding={{ top: 10, leading: 14, trailing: 10, bottom: 4 }}>
        <Text font={10} fontWeight="medium" monospacedDigit foregroundStyle={color} lineLimit={1}>
          {state.date}
        </Text>

        <HStack alignment="center" spacing={4} frame={{ height: 23 }}>
          <Text font={12} fontWeight="bold" foregroundStyle={color} lineLimit={1}>
            {state.weekday}
          </Text>
          <Spacer />
          <Sign text={state.phrase} color={color} />
        </HStack>

        <ZStack frame={{ width: 132, height: 106 }} alignment="bottomLeading">
          {art !== null ? (
            <Image
              image={art}
              resizable
              interpolation="high"
              antialiased
              frame={{ width: 106, height: 106 }}
            />
          ) : (
            <Image systemName="sun.max.fill" font={64} foregroundStyle={color} opacity={0.16} frame={{ width: 106, height: 106 }} />
          )}
        </ZStack>
      </VStack>
    </ZStack>
  );
}
