import {
  AREACODE_FALLBACK,
  BASE_PATH_QR_APP,
  HEADER_X_AUTH_TOKEN,
  JSON_KEY_AREA_CODE,
  RESP_STA_QR_NOT_SCANNED,
} from "../constants"
import { fetch } from "scripting"
import { CSGAPIError, requestJSON, webRequestJSON } from "./http"
import type { LoginChannel } from "../types"

export async function createLoginQrCode(channel: LoginChannel) {
  const loginId = generateLoginId()
  let data: string

  if (channel === "wechat") {
    data = await webRequestJSON<string>("center/createLoginQrcode", {
      [JSON_KEY_AREA_CODE]: AREACODE_FALLBACK,
      channel,
      lgoinId: loginId,
    })
  } else {
    data = await requestCsgAppQrCode("user/manage/createLoginQrcode", {
      channel: "app",
      loginId,
      channelCode: "4",
    })
  }

  return {
    loginId,
    qrImageUrl: data,
  }
}

export async function queryQrLoginStatus(channel: LoginChannel, loginId: string) {
  const isWechat = channel === "wechat"
  const response = await fetch(isWechat
    ? "https://95598.csg.cn/ucs/ma/wt/center/getLoginInfo"
    : `${BASE_PATH_QR_APP}user/manage/getLoginInfo`, {
    method: "POST",
    headers: {
      Host: "95598.csg.cn",
      "Content-Type": "application/json;charset=utf-8",
      Origin: "file://",
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Accept-Language": "zh-CN,cn;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)",
      ...(isWechat ? {} : { channelCode: "3" }),
    },
    body: JSON.stringify(isWechat
      ? { [JSON_KEY_AREA_CODE]: AREACODE_FALLBACK, loginId }
      : { loginId, channelCode: "4" }),
    timeout: 20,
  })

  if (!response.ok) {
    throw new Error(`轮询登录状态失败（HTTP ${response.status}）`)
  }

  const rawText = await response.text()
  const start = rawText.indexOf("{")
  const end = rawText.lastIndexOf("}")
  if (start < 0 || end < start) {
    throw new Error("登录状态返回格式异常。")
  }
  const json = JSON.parse(rawText.slice(start, end + 1))
  if (json?.sta === RESP_STA_QR_NOT_SCANNED) {
    return { ok: false as const, token: null }
  }
  if (json?.sta !== "00") {
    throw new CSGAPIError(String(json?.sta ?? "UNKNOWN"), json?.message)
  }

  const token = response.headers.get(HEADER_X_AUTH_TOKEN)
  if (!token) {
    throw new Error("登录成功，但未拿到认证 token。")
  }

  return { ok: true as const, token }
}

async function requestCsgAppQrCode(path: string, payload: unknown) {
  const response = await fetch(`${BASE_PATH_QR_APP}${path}`, {
    method: "POST",
    headers: {
      Host: "95598.csg.cn",
      "Content-Type": "application/json;charset=utf-8",
      Origin: "file://",
      Accept: "application/json, text/plain, */*",
      channelCode: "3",
    },
    body: JSON.stringify(payload),
    timeout: 20,
  })

  if (!response.ok) {
    throw new Error(`生成南网在线二维码失败（HTTP ${response.status}）`)
  }

  const rawText = await response.text()
  const start = rawText.indexOf("{")
  const end = rawText.lastIndexOf("}")
  if (start < 0 || end < start) {
    throw new Error("南网在线二维码返回格式异常。")
  }

  const json = JSON.parse(rawText.slice(start, end + 1))
  if (json?.sta !== "00" || typeof json?.data !== "string") {
    throw new CSGAPIError(String(json?.sta ?? "UNKNOWN"), json?.message)
  }

  return json.data as string
}

export async function getUserInfo(authToken: string, customerNumber: string) {
  return requestJSON<{ custNumber: string }>("user/getUserInfo", null, {
    authToken,
    customerNumber,
  })
}

export async function getCustomerNumber(authToken: string) {
  console.log("[CSG] getCustomerNumber:start")
  const data = await requestJSON<{ custNumber: string }>("user/getUserInfo", null, {
    authToken,
    customerNumber: "",
  })
  console.log("[CSG] getCustomerNumber:done", "present", Boolean(data.custNumber))

  return data.custNumber
}

function generateLoginId() {
  const raw = `${Date.now()}-${Math.random()}`
  const md5 = Crypto.md5(Data.fromString(raw)!)
  return md5.toHexString()
}
