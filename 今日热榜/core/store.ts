// 设置和缓存都存在脚本自己的 Storage 里（默认私有域）。
// App 和小组件是两个运行环境，共用的就是这几份；读出来一律先验一遍，坏的、旧版本写的都当没有，不让脚本崩。
// 注：Storage 是 Scripting 的全局对象，不用 import。

/** `#RRGGBB`。Scripting 的颜色参数认这个模板字面量类型，直接传字符串会过不了类型检查 */
export type Hex = `#${string}`

export type Board = {
  id: string
  name: string
  icon: string
}

export type Style = {
  /** 小/中/大分别显示几条 */
  smallCount: number
  mediumCount: number
  largeCount: number
  /** 榜单名字号（中号基准，小号自动减 2，大号自动加 1） */
  titleSize: number
  /** 正文与序号字号（中号基准） */
  contentSize: number
  /** 行距（中号基准） */
  lineSpacing: number
  /** 前三名序号颜色 */
  hotColor: Hex
  /** 组件背景色 */
  background: Hex
  showTitle: boolean
  showRefresh: boolean
}

export type Settings = {
  boards: Board[]
  /** 轮换到第几个榜单；每次刷新 +1 */
  cursor: number
  style: Style
}

export type HotItem = { title: string; link: string }

export type BoardData = {
  title: string
  logo: string
  items: HotItem[]
}

export type Cache = {
  version: 1
  /** 取到数据的时刻（UTC 毫秒） */
  fetchedAt: number
  data: BoardData
}

export const DEFAULT_STYLE: Style = {
  smallCount: 5,
  mediumCount: 5,
  largeCount: 12,
  titleSize: 15,
  contentSize: 13,
  lineSpacing: 4,
  hotColor: "#EF233C",
  background: "#151517",
  showTitle: true,
  showRefresh: true,
}

export const DEFAULT_BOARD: Board = {
  id: "KqndgxeLl9",
  name: "微博 ‧ 热搜榜",
  icon: "https://file.ipadown.com/tophub/assets/images/media/s.weibo.com.png_160x160.png",
}

const media = (site: string) => `https://file.ipadown.com/tophub/assets/images/media/${site}.png_160x160.png`

/** 常用榜单：首页目录现在会被站点拦，所以内置一份常用的，设置页里一键添加 */
export const BUILTIN_BOARDS: Board[] = [
  { id: "KqndgxeLl9", name: "微博 ‧ 热搜榜", icon: media("s.weibo.com") },
  { id: "mproPpoq6O", name: "知乎 ‧ 热榜", icon: media("zhihu.com") },
  { id: "Jb0vmloB1G", name: "百度 ‧ 实时热点", icon: media("baidu.com") },
  { id: "DpQvNABoNE", name: "抖音 ‧ 总榜", icon: media("douyin.com") },
  { id: "74KvxwokxM", name: "哔哩哔哩 ‧ 全站日榜", icon: media("bilibili.com") },
  { id: "Om4ejxvxEN", name: "百度贴吧 ‧ 热议榜", icon: media("tieba.baidu.com") },
  { id: "G47o8weMmN", name: "虎扑社区 ‧ 步行街热帖", icon: media("bbs.hupu.com") },
  { id: "Q1Vd5Ko85R", name: "36氪 ‧ 24小时热榜", icon: media("36kr.com") },
  { id: "Y2KeDGQdNP", name: "少数派 ‧ 热门文章", icon: media("sspai.com") },
  { id: "74Kvx59dkx", name: "IT之家 ‧ 日榜", icon: media("ithome.com") },
  { id: "rYqoXQ8vOD", name: "GitHub ‧ Trending Today", icon: media("github.com") },
]

const SETTINGS_KEY = "hot.settings.v1"
const CACHE_PREFIX = "hot.cache.v1."

function clampInt(value: unknown, fallback: number, low: number, high: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(high, Math.max(low, Math.round(num)))
}

function clampNumber(value: unknown, fallback: number, low: number, high: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(high, Math.max(low, Math.round(num * 2) / 2))
}

function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

function parseStyle(raw: unknown): Style {
  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    smallCount: clampInt(record.smallCount, DEFAULT_STYLE.smallCount, 1, 8),
    mediumCount: clampInt(record.mediumCount, DEFAULT_STYLE.mediumCount, 1, 8),
    largeCount: clampInt(record.largeCount, DEFAULT_STYLE.largeCount, 1, 24),
    titleSize: clampNumber(record.titleSize, DEFAULT_STYLE.titleSize, 10, 22),
    contentSize: clampNumber(record.contentSize, DEFAULT_STYLE.contentSize, 9, 18),
    lineSpacing: clampNumber(record.lineSpacing, DEFAULT_STYLE.lineSpacing, 0, 12),
    hotColor: (isHex(record.hotColor) ? record.hotColor.trim() : DEFAULT_STYLE.hotColor) as Hex,
    background: (isHex(record.background) ? record.background.trim() : DEFAULT_STYLE.background) as Hex,
    showTitle: record.showTitle !== false,
    showRefresh: record.showRefresh !== false,
  }
}

function parseBoards(raw: unknown): Board[] {
  if (!Array.isArray(raw)) return []
  const boards: Board[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const record = item as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id.trim() : ""
    if (id === "" || seen.has(id)) continue
    seen.add(id)
    boards.push({
      id,
      name: typeof record.name === "string" && record.name !== "" ? record.name : id,
      icon: typeof record.icon === "string" ? record.icon : "",
    })
  }
  return boards
}

export function defaultSettings(): Settings {
  return { boards: [], cursor: -1, style: { ...DEFAULT_STYLE } }
}

export function loadSettings(): Settings {
  try {
    const raw = Storage.get<unknown>(SETTINGS_KEY)
    if (typeof raw !== "object" || raw === null) return defaultSettings()
    const record = raw as Record<string, unknown>
    const boards = parseBoards(record.boards)
    const cursorNum = Number(record.cursor)
    const cursor = Number.isFinite(cursorNum) ? Math.max(-1, Math.round(cursorNum)) : -1
    return { boards, cursor, style: parseStyle(record.style) }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: Settings): void {
  Storage.set(SETTINGS_KEY, settings)
}

function parseCache(raw: unknown): Cache | null {
  if (typeof raw !== "object" || raw === null) return null
  const record = raw as Record<string, unknown>
  if (record.version !== 1) return null
  const fetchedAt = Number(record.fetchedAt)
  if (!Number.isFinite(fetchedAt)) return null
  const data = record.data as BoardData | undefined
  if (typeof data !== "object" || data === null || !Array.isArray(data.items)) return null
  const items = data.items
    .filter((item) => item && typeof item.title === "string")
    .map((item) => ({ title: item.title, link: typeof item.link === "string" ? item.link : "" }))
  if (items.length === 0) return null
  return {
    version: 1,
    fetchedAt,
    data: {
      title: typeof data.title === "string" ? data.title : "",
      logo: typeof data.logo === "string" ? data.logo : "",
      items,
    },
  }
}

export function loadCache(id: string): Cache | null {
  try {
    return parseCache(Storage.get<unknown>(CACHE_PREFIX + id))
  } catch {
    return null
  }
}

export function saveCache(id: string, cache: Cache): void {
  Storage.set(CACHE_PREFIX + id, cache)
}

/** 清空全部热榜缓存（不动榜单和样式） */
export function clearCaches(): void {
  try {
    const settings = loadSettings()
    for (const board of settings.boards) Storage.remove(CACHE_PREFIX + board.id)
    Storage.remove(CACHE_PREFIX + DEFAULT_BOARD.id)
  } catch {
    // 删不掉就算了，下次取数会覆盖
  }
}
