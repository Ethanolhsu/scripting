// 取某个热榜的页面并解析：tophub.today/n/<id> 是静态 HTML，列表项在 rank-item-container 里，标题在 s-title 里。
//
// 站点有「安全验证」，脚本请求偶尔会被拦（返回 403 验证页）。所以：
//   1. 先用手机 UA 取，解析不到换电脑版 UA 再试一次；
//   2. 还是不行就退回上次成功的缓存；
//   3. 没有缓存就抛错，交给界面画「取不到」。
// 缓存 10 分钟内直接复用，不每次刷新都去打扰站点。

import { loadCache, saveCache, type BoardData, type HotItem } from "./store"

export const TOPHUB = "https://tophub.today"
export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
export const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

const CACHE_MS = 10 * 60 * 1000

/** 网页里的转义字符（&amp; 等）还原成文字 */
export function decodeHtml(text: string): string {
  const names: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }
  return `${text ?? ""}`
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (all, name) => names[`${name}`.toLowerCase()] ?? all)
    .trim()
}

/** 解析热榜页面：榜单名 + 图标 + 每一条（标题、链接） */
export function parseHotPage(html: string): BoardData {
  const result: BoardData = { title: "", logo: "", items: [] }
  if (typeof html !== "string" || html === "") return result

  const brand = /class="brand logo"[^>]*url\(['"]?([^'")]+)['"]?\)[^>]*>([^<]+)</.exec(html)
  if (brand) {
    result.logo = decodeHtml(brand[1])
    result.title = decodeHtml(brand[2])
  } else {
    const pageTitle = /<title>([^<]*)<\/title>/.exec(html)
    result.title = decodeHtml(pageTitle?.[1] ?? "").replace(/\s*[-–—]?\s*今日热榜(官网)?\s*$/, "")
  }

  const itemRegex =
    /<a[^>]*class="[^"]*rank-item-container[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?class="[^"]*s-title[^"]*"[^>]*>([^<]+)</g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(html)) !== null) {
    const link = decodeHtml(match[1])
    const title = decodeHtml(match[2])
    if (title !== "") {
      const item: HotItem = { title, link: link.startsWith("/") ? `${TOPHUB}${link}` : link }
      result.items.push(item)
    }
  }
  return result
}

/** 从输入里取出榜单 ID：可以是链接（tophub.today/n/xxx），也可以直接是 ID */
export function parseBoardId(text: string): { id: string } | null {
  const link = /\/n\/([A-Za-z0-9]+)/.exec(`${text ?? ""}`)
  if (link) return { id: link[1] }
  return /^[A-Za-z0-9]{8,12}$/.test(`${text ?? ""}`.trim()) ? { id: `${text}`.trim() } : null
}

async function fetchPage(id: string, ua: string): Promise<string> {
  const response = await fetch(`${TOPHUB}/n/${id}`, {
    timeout: 12,
    headers: {
      "User-Agent": ua,
      Referer: `${TOPHUB}/`,
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  })
  if (response.status !== 200) throw new Error(`站点返回 ${response.status}`)
  return await response.text()
}

/**
 * 取一个热榜的数据。`force` 为真时跳过缓存（设置页「立即刷新」用）。
 * 拿不到新数据时退回旧缓存；连旧缓存都没有就把错误抛出去。
 */
export async function loadBoard(id: string, force: boolean = false): Promise<BoardData> {
  const cached = loadCache(id)
  if (!force && cached !== null && Date.now() - cached.fetchedAt < CACHE_MS) return cached.data

  let failure: unknown = null
  for (const ua of [MOBILE_UA, DESKTOP_UA]) {
    try {
      const data = parseHotPage(await fetchPage(id, ua))
      if (data.items.length > 0) {
        saveCache(id, { version: 1, fetchedAt: Date.now(), data })
        return data
      }
      failure = new Error("页面里没有解析到榜单内容，可能被站点安全验证拦了")
    } catch (error) {
      failure = error
    }
  }

  if (cached !== null) return cached.data
  throw failure instanceof Error ? failure : new Error("取不到热榜数据")
}
