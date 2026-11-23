import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const main = readFileSync(new URL("../scripts/南方电网/index.tsx", import.meta.url), "utf8")
const login = readFileSync(new URL("../scripts/南方电网/components/qr_login_page.tsx", import.meta.url), "utf8")
const tariff = readFileSync(new URL("../scripts/南方电网/components/local_tariff_entry_page.tsx", import.meta.url), "utf8")

test("uses a standard close icon with a 44pt hit target", () => {
  assert.ok(main.includes('systemName="xmark"'), "close action is not represented by the standard icon")
  assert.ok(main.includes('frame={{ width: 44, height: 44 }}'), "close action does not have a 44pt hit target")
  assert.ok(main.includes("cancellationAction:"), "close action is not in the native toolbar")
})

test("renders channel and account as read-only settings values", () => {
  assert.ok(!main.includes("Menu,"), "read-only settings still import Menu")
  assert.ok(!main.includes("SettingsMenuRow"), "read-only settings still render interactive menus")
  assert.ok(main.includes("SettingsValueRow"), "main settings do not share a read-only value row")
  for (const marker of ['title="扫码渠道"', 'title="已绑定账户"']) {
    assert.ok(main.includes(marker), `missing settings value marker: ${marker}`)
  }

  const row = main.slice(main.indexOf("function SettingsValueRow"), main.indexOf("function IconTile"))
  assert.ok(!row.includes("<Btn"), "read-only settings value is still wrapped in a button")
  assert.ok(!row.includes("chevron"), "read-only settings value still looks editable")
})

test("makes action rows fully tappable", () => {
  const row = main.slice(main.indexOf("function AccountActionRow"), main.indexOf("function IconTile"))
  assert.ok(row.includes('frame={{ maxWidth: "infinity" }}'), "action Button is not full width")
  assert.ok(row.includes('contentShape="rect"'), "action row lacks a rectangular hit shape")
  assert.ok(
    row.includes('background={<Rectangle fill="rgba(255,255,255,0.001)" />}'),
    "transparent row space is not part of the native button hit target",
  )
})

test("uses native List and Picker controls for channel switching", () => {
  for (const marker of [
    "NavigationStack,",
    "List,",
    "Section,",
    "Picker,",
    "<NavigationStack>",
    "<List",
    "<Section",
    "<Picker",
    'title="扫码渠道"',
    'value={selectedChannel}',
    'onChanged={(value: string) => selectChannel(value as LoginChannel)}',
    'pickerStyle="segmented"',
    'LOGIN_CHANNELS.map((item) =>',
    '<Text tag={item.value}>{item.label}</Text>',
    "正在生成微信二维码…",
    "正在生成南网在线二维码…",
    "createLoginQrCode(selectedChannel)",
    "loginId",
    "checkLoginNow",
    "queryQrLoginStatus",
    "[selectedChannel]",
  ]) {
    assert.ok(login.includes(marker), `missing login recovery marker: ${marker}`)
  }

  assert.ok(!login.includes("FullScreenPage"), "QR login still uses the custom full-screen touch hierarchy")
  assert.ok(!login.includes("LoginChannelControl"), "QR login still uses the custom drag control")
  assert.ok(!login.includes("DragGesture"), "QR login still uses custom drag hit testing")
  assert.ok(login.includes("[CSG] qrLogin:channelChanged"), "channel taps are not logged for device diagnosis")
})

test("keeps the QR login page in the root script lifecycle", () => {
  assert.ok(main.includes("const [showQrLogin, setShowQrLogin] = useState(false)"), "main view does not own QR presentation state")
  assert.ok(main.includes("fullScreenCover={{"), "QR login is not presented by an in-tree full-screen cover")
  assert.ok(main.includes("isPresented: showQrLogin"), "full-screen cover is not bound to QR presentation state")
  assert.ok(main.includes("content: <QRLoginPage"), "full-screen cover does not render the QR login page")
  assert.ok(main.includes("onChannelChanged={setLoginChannel}"), "main view does not receive channel changes from QR login")

  const qrHandler = main.slice(main.indexOf("function handleQrLogin"), main.indexOf("function handleSyncAccounts"))
  assert.ok(!qrHandler.includes("presentFullScreen"), "QR login still starts a nested Navigation.present lifecycle")
  assert.ok(login.includes("onAuthenticated"), "QR login cannot return a successful token through the live component tree")
  assert.ok(login.includes("onChannelChanged?: (channel: LoginChannel) => void"), "QR login does not expose channel changes")
  assert.ok(login.includes("onChannelChanged?.(nextChannel)"), "QR login does not send the selected channel to the main view")
  assert.ok(!login.includes("Navigation.useDismiss"), "QR login still depends on a nested Navigation.present dismiss context")
})

test("returns the successful channel and explains the authorization handoff", () => {
  assert.ok(
    login.includes("await onAuthenticated({ token: status.token, channel: selectedChannel })"),
    "login does not return the channel that produced the token",
  )
  assert.ok(main.includes("setLoginChannel(loginResult.channel)"), "successful channel is not persisted on the main screen")
  assert.ok(login.includes("微信二维码会进入南方电网公众号"), "WeChat authorization behavior is not explained")
  assert.ok(login.includes("请打开南网在线 App"), "CSG App authorization behavior is not explained")
})

test("invalidates Widget data after a successful authenticated account sync", () => {
  const loginHandler = main.slice(
    main.indexOf("async function handleQrLoginResult"),
    main.indexOf("async function handleSyncAccounts"),
  )
  const syncIndex = loginHandler.indexOf("await syncLinkedAccounts()")
  const clearIndex = loginHandler.indexOf("clearWidgetCache()")
  const reloadIndex = loginHandler.indexOf("Widget.reloadAll()")

  assert.ok(syncIndex >= 0, "successful login does not sync linked accounts")
  assert.ok(clearIndex > syncIndex, "successful login does not clear stale Widget data after account sync")
  assert.ok(reloadIndex > clearIndex, "successful login does not reload Widgets after clearing stale data")
})

test("requests per-script photo access before starting tariff OCR", () => {
  const permissionRequest = tariff.indexOf('Script.requestAccess(["photos"])')
  const photoPicker = tariff.indexOf("Photos.pick")

  assert.ok(permissionRequest >= 0, "tariff OCR does not proactively request photo access")
  assert.ok(photoPicker > permissionRequest, "photo picker runs before the permission result is checked")
  assert.ok(tariff.includes('granted.includes("photos")'), "tariff OCR does not handle denied photo access")
})

test("reports when WeChat cannot be opened and gives CSG App instructions", () => {
  assert.ok(
    login.includes("const opened = await Safari.openURL"),
    "scanner handoff ignores the Safari.openURL result",
  )
  assert.ok(login.includes("if (!opened)"), "scanner handoff does not handle an unavailable URL scheme")
  assert.ok(login.includes("无法打开"), "scanner handoff does not give the user an actionable failure message")
  assert.ok(login.includes("南网在线 App"), "CSG App handoff instructions are missing")
})

test("requests photo access before saving a login QR code", () => {
  const permissionRequest = login.indexOf('Script.requestAccess(["photos"])')
  const savePhoto = login.indexOf("Photos.savePhoto")

  assert.ok(permissionRequest >= 0, "QR login does not proactively request photo access")
  assert.ok(savePhoto > permissionRequest, "QR image is saved before photo access is checked")
  assert.ok(login.includes('granted.includes("photos")'), "QR login does not handle denied photo access")
})
