import { HStack, Image, Text, VStack, Widget } from 'scripting'
import type { HitokotoData } from './utils/hitokoto-service'
import { fetchHitokoto, getCurrentSettings, getDynamicTextColor } from './utils/hitokoto-service'

// 无需全局缓存变量，每次都获取新数据

/**
 * 生成背景样式
 */
const generateWidgetBackground = (settings: any) => {
  // 如果开启了颜色背景，优先使用颜色背景
  if (settings.enableColorBackground && settings.backgroundColors && settings.backgroundColors.length > 0) {
    const colors = settings.backgroundColors

    if (colors.length === 1) {
      // 单个颜色，使用纯色背景
      return colors[0]
    } else {
      // 多个颜色，使用渐变背景
      return {
        gradient: colors.map((color: any, index: number) => ({
          color: color,
          location: index / (colors.length - 1)
        })),
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 1, y: 1 }
      }
    }
  }

  // 未自定义背景时，使用浅紫渐变背景，贴近目标样式（深色模式自动适配）
  return {
    gradient: [
      { color: { light: '#F1F1F8', dark: '#26263A' }, location: 0 },
      { color: { light: '#E4E4F0', dark: '#1B1B29' }, location: 1 }
    ],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 }
  }
}

/**
 * 生成来源署名，格式：—— 作者·《来源》
 */
const formatSource = (data: HitokotoData): string => {
  const from = data.from && data.from !== '未知' ? data.from : ''
  const who = data.from_who || ''
  if (who && from) return `—— ${who}·《${from}》`
  if (from) return `—— 《${from}》`
  if (who) return `—— ${who}`
  return ''
}

// 署名文字颜色，自动适配浅色/深色模式
const sourceColor = { light: '#8E8E93', dark: '#A0A0A8' }

/**
 * 按正文长度自适应字号与行距：
 * 从首选字号往下试，直到估算的排版高度放得进正文可用区域，保证长句也能完整显示。
 * 宽高取各尺寸小组件内容区的保守估值（兼容小屏机型）。
 */
const fitBodyStyle = (
  text: string,
  areaWidth: number,
  areaHeight: number,
  preferredFont: number
): { font: number; lineSpacing: number } => {
  const segments = text.split('\n')
  for (let font = preferredFont; font >= 9; font--) {
    const lineSpacing = Math.max(2, Math.round(font * 0.35))
    const charsPerLine = Math.max(1, Math.floor(areaWidth / font))
    const lines = segments.reduce((total, seg) => total + Math.max(1, Math.ceil(seg.length / charsPerLine)), 0)
    if (lines * font + (lines - 1) * lineSpacing <= areaHeight) {
      return { font, lineSpacing }
    }
  }
  return { font: 9, lineSpacing: 1 }
}

/**
 * 加载数据的异步函数
 */
const loadHitokotoData = async (): Promise<HitokotoData> => {
  try {
    const data = await fetchHitokoto()
    console.log('获取一言数据成功:', data.hitokoto)
    return data
  } catch (error) {
    console.error('加载一言数据失败:', error)
    // 返回默认数据
    return {
      id: 0,
      uuid: '',
      hitokoto: '数据加载失败',
      type: 'a',
      from: '未知',
      from_who: null,
      creator: '',
      creator_uid: 0,
      reviewer: 0,
      commit_from: '',
      created_at: '',
      length: 0
    }
  }
}

/**
 * Widget视图 - 根据不同尺寸显示不同布局
 * 样式参照：左上角 logo + 标题，正文左对齐宽行距，右下角来源署名
 * 正文独占标题与署名之间的全部空间（不再放 Spacer，避免平分高度导致截断）
 */
const WidgetView = ({ data }: { data: HitokotoData }) => {
  const settings = getCurrentSettings()

  const widgetBackground = generateWidgetBackground(settings)

  // 获取动态字体颜色（会自动适配系统的浅色/深色模式）
  const textColor = getDynamicTextColor()

  switch (Widget.family) {
    case 'systemSmall': {
      // 小尺寸小组件 - 左上角标题，左对齐一言内容，右下角来源
      const body = fitBodyStyle(data.hitokoto, 118, 84, 15)
      return (
        <VStack spacing={8} padding={14} alignment="leading" widgetBackground={widgetBackground}>
          <HStack spacing={6} alignment="center">
            <Image systemName="quote.bubble.fill" font="body" foregroundStyle="systemBlue" />
            <Text font="subheadline" fontWeight="semibold" foregroundStyle={textColor}>
              一言
            </Text>
          </HStack>
          <Text
            font={body.font}
            lineSpacing={body.lineSpacing}
            minScaleFactor={0.6}
            multilineTextAlignment="leading"
            foregroundStyle={textColor}
            frame={{
              maxWidth: 'infinity',
              maxHeight: 'infinity',
              alignment: 'leading'
            }}
          >
            {data.hitokoto}
          </Text>
          <Text font={10} lineLimit={1} minScaleFactor={0.7} foregroundStyle={sourceColor} frame={{ maxWidth: 'infinity', alignment: 'trailing' }}>
            {formatSource(data)}
          </Text>
        </VStack>
      )
    }

    case 'systemMedium': {
      // 中等尺寸小组件 - 同样式，正文更大
      const body = fitBodyStyle(data.hitokoto, 280, 70, 17)
      return (
        <VStack spacing={10} padding={{ horizontal: 16, top: 16, bottom: 12 }} alignment="leading" widgetBackground={widgetBackground}>
          <HStack spacing={6} alignment="center">
            <Image systemName="quote.bubble.fill" font="body" foregroundStyle="systemBlue" />
            <Text font="headline" fontWeight="semibold" foregroundStyle={textColor}>
              一言
            </Text>
          </HStack>
          <Text
            font={body.font}
            lineSpacing={body.lineSpacing}
            minScaleFactor={0.6}
            multilineTextAlignment="leading"
            foregroundStyle={textColor}
            frame={{
              maxWidth: 'infinity',
              maxHeight: 'infinity',
              alignment: 'leading'
            }}
          >
            {data.hitokoto}
          </Text>
          <Text font={10} lineLimit={1} minScaleFactor={0.7} foregroundStyle={sourceColor} frame={{ maxWidth: 'infinity', alignment: 'trailing' }}>
            {formatSource(data)}
          </Text>
        </VStack>
      )
    }

    case 'systemLarge':
    case 'systemExtraLarge': {
      // 大尺寸小组件 - 同样式，正文最大
      const body = fitBodyStyle(data.hitokoto, 280, 220, 20)
      return (
        <VStack spacing={14} padding={20} alignment="leading" widgetBackground={widgetBackground}>
          <HStack spacing={8} alignment="center">
            <Image systemName="quote.bubble.fill" font="title2" foregroundStyle="systemBlue" />
            <Text font="title2" fontWeight="semibold" foregroundStyle={textColor}>
              一言
            </Text>
          </HStack>
          <Text
            font={body.font}
            lineSpacing={body.lineSpacing}
            minScaleFactor={0.6}
            multilineTextAlignment="leading"
            foregroundStyle={textColor}
            frame={{
              maxWidth: 'infinity',
              maxHeight: 'infinity',
              alignment: 'leading'
            }}
          >
            {data.hitokoto}
          </Text>
          <Text font={11} lineLimit={1} minScaleFactor={0.7} foregroundStyle={sourceColor} frame={{ maxWidth: 'infinity', alignment: 'trailing' }}>
            {formatSource(data)}
          </Text>
        </VStack>
      )
    }

    default:
      return (
        <VStack spacing={8} alignment="center" padding={16}>
          <Image systemName="quote.bubble.fill" font="title" foregroundStyle="systemBlue" />
          <Text font="body" foregroundStyle={textColor}>
            一言小组件
          </Text>
          <Text font="caption" foregroundStyle={textColor}>
            今日一言
          </Text>
        </VStack>
      )
  }
}

/**
 * 主函数 - 异步加载数据并呈现Widget
 */
const main = async (): Promise<void> => {
  try {
    const data = await loadHitokotoData()
    const settings = getCurrentSettings()

    if (settings.autoRefresh) {
      // 计算下次刷新时间
      const refreshIntervalMs = settings.refreshInterval * 60 * 1000 // 转换为毫秒
      const nextRefreshDate = new Date(Date.now() + refreshIntervalMs)

      console.log(`组件设置自动刷新，间隔: ${settings.refreshInterval}分钟，下次刷新: ${nextRefreshDate.toLocaleString()}`)

      // 使用定时刷新策略
      Widget.present(<WidgetView data={data} />, {
        policy: 'after',
        date: nextRefreshDate
      })
    } else {
      // 禁用自动刷新时使用默认策略
      console.log('组件禁用自动刷新，使用默认刷新策略')
      Widget.present(<WidgetView data={data} />)
    }
  } catch (error) {
    console.error('Widget加载失败:', error)

    // 获取动态字体颜色以便在错误显示时也能自动适配颜色模式
    const errorTextColor = getDynamicTextColor()

    // 显示错误信息
    Widget.present(
      <VStack spacing={8} alignment="center" padding={16}>
        <Image systemName="exclamationmark.triangle.fill" font="title" foregroundStyle="systemRed" />
        <Text font="body" foregroundStyle={errorTextColor}>
          数据加载失败
        </Text>
        <Text font="caption" foregroundStyle={errorTextColor}>
          请检查网络连接
        </Text>
      </VStack>
    )
  }
}

// 执行主函数
main()