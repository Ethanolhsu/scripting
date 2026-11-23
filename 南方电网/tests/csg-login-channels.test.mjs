import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const constants = readFileSync(new URL("../scripts/南方电网/constants.ts", import.meta.url), "utf8")
const types = readFileSync(new URL("../scripts/南方电网/types.ts", import.meta.url), "utf8")
const storage = readFileSync(new URL("../scripts/南方电网/storage.ts", import.meta.url), "utf8")
const auth = readFileSync(new URL("../scripts/南方电网/api/auth.ts", import.meta.url), "utf8")
const login = readFileSync(new URL("../scripts/南方电网/components/qr_login_page.tsx", import.meta.url), "utf8")

test("exposes only WeChat and CSG App login channels", () => {
  assert.ok(types.includes('LoginChannel = "app" | "wechat"'))
  assert.ok(!types.includes('"alipay"'))
  assert.ok(constants.includes('{ label: "南网在线", value: "app" }'))
  assert.ok(constants.includes('{ label: "微信", value: "wechat" }'))
  assert.ok(!constants.includes("支付宝"))
  assert.ok(!login.includes("支付宝"))
  assert.ok(!login.includes("alipayqr://"))
})

test("migrates a previously saved Alipay channel to CSG App", () => {
  assert.ok(storage.includes('saved?.loginChannel === "wechat" ? "wechat" : "app"'))
  assert.ok(storage.includes("loginChannel: normalizedLoginChannel"))
})

test("uses the official current CSG App QR endpoints", () => {
  assert.ok(constants.includes('BASE_PATH_QR_APP = "https://95598.csg.cn/mp/w2/wx/userauth/"'))
  assert.ok(auth.includes('"user/manage/createLoginQrcode"'))
  assert.ok(auth.includes("user/manage/getLoginInfo"))
  assert.ok(auth.includes('channelCode: "3"'))
  assert.ok(auth.includes('channelCode: "4"'))
  assert.ok(auth.includes("loginId"))
  assert.ok(!auth.includes("channel: \"alipay\""))
})

test("creates and polls QR login using the selected channel", () => {
  assert.ok(auth.includes('if (channel === "wechat")'))
  assert.ok(auth.includes("queryQrLoginStatus(channel: LoginChannel, loginId: string)"))
  assert.ok(login.includes("queryQrLoginStatus(selectedChannel, loginId)"))
  assert.ok(login.includes("queryQrLoginStatus(selectedChannel, result.loginId)"))
  assert.ok(login.includes("LOGIN_CHANNELS.map"))
  assert.ok(login.includes("正在生成南网在线二维码…"))
  assert.ok(login.includes("请打开南网在线 App"))
  assert.ok(login.includes("保存二维码并查看操作说明"))
})
