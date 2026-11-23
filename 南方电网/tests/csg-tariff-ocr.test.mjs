import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const { extractTariffInformation } = await import(new URL("../scripts/南方电网/utils/tariff_ocr.ts", import.meta.url))
const entryPage = readFileSync(new URL("../scripts/南方电网/components/local_tariff_entry_page.tsx", import.meta.url), "utf8")

function candidate(content, x, y, width = 0.08, height = 0.012) {
  return { content, confidence: 0.96, boundingBox: { x, y, width, height } }
}

test("extracts split tier prices and removes unrelated OCR lines", () => {
  const result = extractTariffInformation(`
    广东电网有限责任公司
    居民生活用电阶梯电价表
    扫一扫关注公众号
    第一档
    0-260 千瓦时
    0.6089 元/度
    客服电话 95598
    第二档 261-600 千瓦时 0.6589 元/度
    第 1 页 共 2 页
    第三档 601 千瓦时以上
    0.9089 元 / 千瓦时
  `)

  assert.equal(result.priceCount, 3)
  assert.equal(result.facts.length, 3)
  assert.match(result.facts[0], /第一档.*0\.6089 元\/度/)
  assert.match(result.facts[1], /第二档.*0\.6589 元\/度/)
  assert.match(result.facts[2], /第三档.*0\.9089 元\/度/)
  assert.doesNotMatch(result.text, /居民生活用电阶梯电价表/)
  assert.doesNotMatch(result.text, /公众号|客服电话|第 1 页|广东电网有限责任公司/)
  assert.ok(result.ignoredLineCount >= 4)
})

test("keeps peak flat and valley tariffs with valid price units", () => {
  const result = extractTariffInformation(`
    峰谷分时电价
    高峰 10:00-12:00 1.0076 元/千瓦时
    平段 12:00-14:00 0.6089 元/度
    低谷 00:00-08:00 0.2293 元/千瓦时
    图片仅供参考 2026-07-15
  `)

  assert.equal(result.priceCount, 3)
  assert.match(result.text, /高峰.*1\.0076 元\/度/)
  assert.match(result.text, /平段.*0\.6089 元\/度/)
  assert.match(result.text, /低谷.*0\.2293 元\/度/)
  assert.doesNotMatch(result.text, /仅供参考/)
})

test("rejects bills and account data that do not contain a tariff unit", () => {
  const result = extractTariffInformation(`
    2026 年 7 月电费账单
    缴费户号 DEMO_ACCOUNT
    本月应缴金额 123.45 元
    客户名称 示例用户
  `)

  assert.equal(result.priceCount, 0)
  assert.deepEqual(result.facts, [])
  assert.equal(result.text, "")
})

test("normalizes common OCR punctuation and decimal mistakes", () => {
  const result = extractTariffInformation(`
    第一档：O.6089元／度
    第一档：O.6089元／度
    第二档：0，6589元／千瓦时
  `)

  assert.equal(result.priceCount, 2)
  assert.match(result.text, /第一档 0\.6089 元\/度/)
  assert.match(result.text, /第二档 0\.6589 元\/度/)
})

test("reconstructs a dense table and selects the delivered tariff for the linked account area", () => {
  const candidates = [
    candidate("单位：分/千瓦时（含税）", 0.35, 0.94, 0.22),
    candidate("电价", 0.58, 0.90),
    candidate("重大水利工程建设基金", 0.68, 0.90, 0.12),
    candidate("水库移民后期扶持基金", 0.79, 0.90, 0.12),
    candidate("到户电价", 0.91, 0.90),
    candidate("连山县", 0.16, 0.84),
    candidate("第一档", 0.48, 0.80),
    candidate("55.22", 0.58, 0.80),
    candidate("0.196875", 0.70, 0.80),
    candidate("0.67", 0.81, 0.80),
    candidate("56.086875", 0.91, 0.80),
    candidate("第二档", 0.48, 0.77),
    candidate("60.22", 0.58, 0.77),
    candidate("0.196875", 0.70, 0.77),
    candidate("0.67", 0.81, 0.77),
    candidate("61.086875", 0.91, 0.77),
    candidate("第三档", 0.48, 0.74),
    candidate("85.22", 0.58, 0.74),
    candidate("0.196875", 0.70, 0.74),
    candidate("0.67", 0.81, 0.74),
    candidate("86.086875", 0.91, 0.74),
    candidate("连州市", 0.16, 0.68),
    candidate("第一档", 0.48, 0.64),
    candidate("58.25", 0.58, 0.64),
    candidate("0.196875", 0.70, 0.64),
    candidate("0.67", 0.81, 0.64),
    candidate("59.116875", 0.91, 0.64),
  ]

  const result = extractTariffInformation(candidates.map((item) => item.content).join("\n"), {
    candidates,
    accountAddress: "测试省测试市连山县",
  })

  assert.equal(result.priceCount, 3)
  assert.deepEqual(result.facts, [
    "第一档 0.56086875 元/度",
    "第二档 0.61086875 元/度",
    "第三档 0.86086875 元/度",
  ])
  assert.doesNotMatch(result.text, /连州市|0\.59116875|55\.22|0\.196875/)
})

test("uses tall merged region and variant cells as spatial boundaries", () => {
  const candidates = [
    candidate("单位：分/千瓦时（含税）", 0.35, 0.94, 0.22),
    candidate("到户电价", 0.91, 0.90),
    candidate("连南县", 0.16, 0.70, 0.08, 0.14),
    candidate("专变", 0.30, 0.76, 0.06, 0.07),
    candidate("第一档", 0.48, 0.80),
    candidate("56.086875", 0.91, 0.80),
    candidate("第二档", 0.48, 0.77),
    candidate("61.086875", 0.91, 0.77),
    candidate("公变", 0.30, 0.70, 0.06, 0.05),
    candidate("第一档", 0.48, 0.72),
    candidate("57.486875", 0.91, 0.72),
    candidate("连州市", 0.16, 0.59, 0.08, 0.06),
    candidate("第一档", 0.48, 0.62),
    candidate("59.116875", 0.91, 0.62),
    candidate("农业生产电价", 0.48, 0.54),
    candidate("52.906875", 0.91, 0.54),
  ]

  const result = extractTariffInformation(candidates.map((item) => item.content).join("\n"), {
    candidates,
    accountAddress: "测试省测试市连南县",
  })

  assert.deepEqual(result.facts, [
    "专变 第一档 0.56086875 元/度",
    "专变 第二档 0.61086875 元/度",
    "公变 第一档 0.57486875 元/度",
  ])
})

test("inherits a table unit and uses the final delivered-price value in plain OCR text", () => {
  const result = extractTariffInformation(`
    单位 分/千瓦时 含税
    到户电价
    第一档 55.22 0.196875 0.67 56.086875
    第二档 60.22 0.196875 0.67 61.086875
    本月应缴金额 123.45 元
    缴费户号 DEMO_ACCOUNT
  `)

  assert.deepEqual(result.facts, [
    "第一档 0.56086875 元/度",
    "第二档 0.61086875 元/度",
  ])
  assert.doesNotMatch(result.text, /123\.45|DEMO_ACCOUNT|0\.196875/)
})

test("wires filtered OCR output into image import and save", () => {
  assert.ok(entryPage.includes('import { extractTariffInformation } from "../utils/tariff_ocr"'))
  assert.ok(entryPage.includes("const extracted = extractTariffInformation(recognizedText, {"))
  assert.ok(entryPage.includes("setText(extracted.text)"))
  assert.ok(entryPage.includes("extractTariffInformation(text)"))
  assert.ok(entryPage.includes("剔除"))
  assert.ok(entryPage.includes("没有提取到有效电价"))
})

test("configures Vision for dense small text and passes spatial candidates with account context", () => {
  assert.ok(entryPage.includes("minimumTextHeight: 0.004"))
  assert.ok(entryPage.includes("customWords:"))
  assert.ok(entryPage.includes("candidates: recognized.candidates"))
  assert.ok(entryPage.includes("accountAddress: saved.selectedAccount?.address"))
  assert.ok(entryPage.includes("tariffOCR:vision"))
  assert.ok(entryPage.includes("tariffOCR:extracted"))
  assert.ok(entryPage.includes("facts: extracted.facts"))
})
