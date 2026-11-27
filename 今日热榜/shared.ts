// 今日热榜 · Scripting 版 —— 公共逻辑（数据、缓存、解析、设置读写）
// 原项目：cnb.cool/enjoyeetime/MyScriptable › 今日热榜（Scriptable 组件，依赖 _LSP.js）
// 这里只保留数据层与解析层，UI 分别放在 index.tsx（设置页）和 widget.tsx（组件）

export const TOPHUB = "https://tophub.today"
export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
export const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

/** 没有添加任何榜单时默认显示的榜单 */
export const DEFAULT_BOARD: Board = { id: "KqndgxeLl9", name: "微博 ‧ 热搜榜", icon: "" }

const media = (site: string) => `https://file.ipadown.com/tophub/assets/images/media/${site}.png_160x160.png`

/** 常用榜单：首页目录取不到时也能搜到、添加 */
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

export type Board = {
  id: string
  name: string
  icon?: string
}

export type HotItem = {
  title: string
  link: string
}

export type BoardData = {
  title: string
  logo: string
  items: HotItem[]
}

export type Style = {
  smallCount: number
  mediumCount: number
  largeCount: number
  titleFontSize: number
  contentFontSize: number
  lineSpacing: number
  /** 留空表示跟随浅色/深色自动（#1C1C1E / #FFFFFF）；填 #RRGGBB 固定 */
  titleColor: string
  contentColor: string
  /** 前三名序号颜色 */
  hotColor: string
  showTitle: boolean
  showRefresh: boolean
}

export type Settings = {
  boards: Board[]
  cursor: number
  style: Style
}

export const DEFAULT_STYLE: Style = {
  smallCount: 5,
  mediumCount: 5,
  largeCount: 12,
  titleFontSize: 16,
  contentFontSize: 13,
  lineSpacing: 4,
  titleColor: "",
  contentColor: "",
  hotColor: "#EF233C",
  showTitle: true,
  showRefresh: true,
}

// ---------------------------------------------------------------- 存储
// 组件进程只能访问 App Group 目录（不是脚本目录），所以设置、缓存都放这里，
// 这样 index.tsx（App 内）和 widget.tsx（桌面组件）看到的是同一份数据。

const DIR_NAME = "今日热榜"

function baseDir(): string {
  const fm = FileManager
  const root = fm.appGroupDocumentsDirectory || fm.documentsDirectory
  return `${root}/${DIR_NAME}`
}

const settingsPath = () => `${baseDir()}/settings.json`
const boardCachePath = (id: string) => `${baseDir()}/cache/${id}.json`
const logoCachePath = (url: string) => `${baseDir()}/logo/${hashOf(url)}.png`

function ensureDir(path: string) {
  try {
    FileManager.createDirectorySync(path, true)
  } catch (e) {
    // 已存在时忽略
  }
}

export function loadSettings(): Settings {
  try {
    const path = settingsPath()
    if (FileManager.existsSync(path)) {
      const raw = JSON.parse(FileManager.readAsStringSync(path))
      return {
        boards: Array.isArray(raw?.boards) ? raw.boards.filter((b: Board) => b && b.id) : [],
        cursor: Number.isFinite(raw?.cursor) ? Number(raw.cursor) : -1,
        style: { ...DEFAULT_STYLE, ...(raw?.style ?? {}) },
      }
    }
  } catch (e) {
    console.log("读取设置失败", e)
  }
  return { boards: [], cursor: -1, style: { ...DEFAULT_STYLE } }
}

export function saveSettings(settings: Settings) {
  try {
    ensureDir(baseDir())
    FileManager.writeAsStringSync(settingsPath(), JSON.stringify(settings))
  } catch (e) {
    console.log("保存设置失败", e)
  }
}

// ---------------------------------------------------------------- 网络

async function fetchText(url: string, referer?: string, ua?: string): Promise<string> {
  const headers: Record<string, string> = { "User-Agent": ua || MOBILE_UA }
  if (referer) headers["Referer"] = referer
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return await response.text()
}

// ---------------------------------------------------------------- 解析

/** 网页里的转义字符（&amp; 等）还原成文字 */
export function decodeHtml(text: string): string {
  const names: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }
  return `${text ?? ""}`
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (all, name) => names[name.toLowerCase()] ?? all)
    .trim()
}

/** 解析某个热榜的页面（tophub.today/n/xxx） */
export function parseHotPage(html: string): BoardData {
  const result: BoardData = { title: "", logo: "", items: [] }
  if (typeof html !== "string") return result

  const brand = /class="brand logo"[^>]*url\(['"]?([^'")]+)['"]?\)[^>]*>([^<]+)</.exec(html)
  if (brand) {
    result.logo = decodeHtml(brand[1])
    result.title = decodeHtml(brand[2])
  } else {
    const pageTitle = /<title>([^<]*)<\/title>/.exec(html)
    result.title = decodeHtml(pageTitle?.[1] ?? "").replace(/\s*今日热榜(官网)?\s*$/, "")
  }

  const itemRegex =
    /<a[^>]*class="[^"]*rank-item-container[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?class="[^"]*s-title[^"]*"[^>]*>([^<]+)</g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(html)) !== null) {
    const link = decodeHtml(match[1])
    const title = decodeHtml(match[2])
    if (title) result.items.push({ title, link: link.startsWith("/") ? `${TOPHUB}${link}` : link })
  }
  return result
}

/** 解析首页上列出来的榜单（手机版、电脑版两种写法都认） */
export function parseCatalog(html: string): Board[] {
  const boards: Board[] = []
  if (typeof html !== "string") return boards
  const seen = new Set<string>()
  const add = (id: string, icon: string, name: string) => {
    if (name && !seen.has(id)) {
      seen.add(id)
      boards.push({ id, icon: decodeHtml(icon), name })
    }
  }
  let match: RegExpExecArray | null
  const mobileRegex = /<a href="\/n\/([A-Za-z0-9]+)">\s*<img src="([^"]*)"[\s\S]*?class="node-name">([^<]+)</g
  while ((match = mobileRegex.exec(html)) !== null) add(match[1], match[2], decodeHtml(match[3]))

  const desktopRegex =
    /<a href="\/n\/([A-Za-z0-9]+)">(?:(?!<\/a>)[\s\S])*?<img[^>]*src="([^"]*)"(?:(?!<\/a>)[\s\S])*?class="zb-kc-Cb">([^<]*)<span>([^<]*)<\/span>/g
  while ((match = desktopRegex.exec(html)) !== null) {
    add(match[1], match[2], [decodeHtml(match[3]), decodeHtml(match[4])].filter(Boolean).join(" ‧ "))
  }
  return boards
}

/** 从输入里取出热榜 ID：可以是链接（tophub.today/n/xxx），也可以直接是 ID */
export function parseBoardId(text: string): { id: string; isLink: boolean } | null {
  const link = /\/n\/([A-Za-z0-9]+)/.exec(text)
  if (link) return { id: link[1], isLink: true }
  return /^[A-Za-z0-9]{8,12}$/.test(text) ? { id: text, isLink: false } : null
}

// ---------------------------------------------------------------- 数据缓存

const CACHE_SECONDS = 10 * 60

export async function loadBoardData(id: string): Promise<BoardData> {
  const path = boardCachePath(id)
  try {
    if (FileManager.existsSync(path)) {
      const cache = JSON.parse(FileManager.readAsStringSync(path))
      const age = (Date.now() - Number(cache?.time ?? 0)) / 1000
      if (age >= 0 && age < CACHE_SECONDS && cache?.data) return cache.data as BoardData
    }
  } catch (e) {
    // 缓存坏了就重新取
  }

  try {
    let data = parseHotPage(await fetchText(`${TOPHUB}/n/${id}`, `${TOPHUB}/`, MOBILE_UA))
    // 偶尔会被站点判定成脚本，换电脑版 UA 再试一次
    if (data.items.length === 0) {
      data = parseHotPage(await fetchText(`${TOPHUB}/n/${id}`, `${TOPHUB}/`, DESKTOP_UA))
    }
    if (data.items.length > 0) {
      try {
        ensureDir(`${baseDir()}/cache`)
        FileManager.writeAsStringSync(path, JSON.stringify({ time: Date.now(), data }))
      } catch (e) {}
      return data
    }
    throw new Error("页面里没有解析到榜单内容（可能被站点安全验证拦截）")
  } catch (e) {
    // 断网时退回旧缓存
    try {
      const cache = JSON.parse(FileManager.readAsStringSync(path))
      if (cache?.data) return cache.data as BoardData
    } catch (err) {}
    throw e
  }
}

/** 把榜单图标下载到 App Group，返回本地路径（失败返回 null） */
export async function loadLogoPath(iconUrl?: string): Promise<string | null> {
  if (!iconUrl) return null
  const path = logoCachePath(iconUrl)
  try {
    if (FileManager.existsSync(path)) return path
  } catch (e) {}

  try {
    const response = await fetch(iconUrl, {
      headers: { "User-Agent": MOBILE_UA, Referer: `${TOPHUB}/` },
    })
    if (!response.ok) return null
    const data = await response.data()
    ensureDir(`${baseDir()}/logo`)
    FileManager.writeAsDataSync(path, data)
    return path
  } catch (e) {
    console.log("图标加载失败", e)
    return null
  }
}

// ---------------------------------------------------------------- 其他

/** 选这次要显示的榜单：Parameter 里填了榜单名就固定显示它，否则按顺序轮换 */
export function pickBoard(boards: Board[], cursor: number, parameter: string): Board {
  const list = boards.filter((b) => b?.id)
  if (list.length === 0) return DEFAULT_BOARD

  const simplify = (text: string) => `${text ?? ""}`.toLowerCase().replace(/[\s‧·•]/g, "")
  const keyword = simplify(parameter ?? "")
  const pinned = keyword ? list.find((b) => simplify(b.name).includes(keyword) || b.id === keyword) : null
  if (pinned) return pinned

  const index = ((cursor % list.length) + list.length) % list.length
  return list[index]
}

/** 榜单名匹配：用于设置页里的「已添加」判断 */
export function simplifyName(text: string): string {
  return `${text ?? ""}`.toLowerCase().replace(/[\s‧·•]/g, "")
}

export function formatTime(date: Date): string {
  return `${date.getHours()}`.padStart(2, "0") + ":" + `${date.getMinutes()}`.padStart(2, "0")
}

function hashOf(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return h.toString(16)
}
