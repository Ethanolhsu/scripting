import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const http = readFileSync(new URL("../scripts/南方电网/api/http.ts", import.meta.url), "utf8")
const auth = readFileSync(new URL("../scripts/南方电网/api/auth.ts", import.meta.url), "utf8")
const power = readFileSync(new URL("../scripts/南方电网/services/power.ts", import.meta.url), "utf8")
const widgetEntry = readFileSync(new URL("../scripts/南方电网/widget.tsx", import.meta.url), "utf8")
const widgetSettings = readFileSync(new URL("../scripts/南方电网/components/widget_settings_page.tsx", import.meta.url), "utf8")
const tariff = readFileSync(new URL("../scripts/南方电网/utils/tariff.ts", import.meta.url), "utf8")
const tariffTests = readFileSync(new URL("./csg-tariff-ocr.test.mjs", import.meta.url), "utf8")
const billingTests = readFileSync(new URL("./csg-billing-data.test.mjs", import.meta.url), "utf8")

test("does not keep account-like fixtures in publishable source", () => {
  for (const [name, source] of [
    ["widget settings", widgetSettings],
    ["tariff tests", tariffTests],
    ["billing tests", billingTests],
  ]) {
    assert.doesNotMatch(source, /\b\d{15,19}\b/, `${name} contains an account-like number`)
  }

  const personalNameMarker = "\u5218\u5174\u65fa"
  assert.ok(!tariffTests.includes(personalNameMarker), "tariff tests contain a personal name")
})

test("does not log request payloads or personal account values", () => {
  assert.ok(!http.includes('"payload", payload'), "request payloads are logged")
  assert.ok(!auth.includes('"getCustomerNumber:done", data.custNumber'), "customer number is logged")
  assert.ok(!power.includes('"syncLinkedAccounts:customerNumber", customerNumber'), "customer number is logged")
  assert.ok(!power.includes('"syncLinkedAccounts:queryMeteringPoint", item.eleCustNumber'), "account number is logged")
  assert.ok(!power.includes('"fetchWidgetData:account", account.accountNumber'), "account number is logged")
  assert.ok(!power.includes('"fetchWidgetData:customerNumber", customerNumber'), "customer number is logged")
  assert.ok(!power.includes('"fetchWidgetData:done", JSON.stringify'), "financial result values are logged")
  assert.ok(!widgetEntry.includes("paymentNumber: settings.paymentNumber"), "Widget logs the payment number")
  assert.ok(!widgetEntry.includes("selectedAccount: settings.selectedAccount?.accountNumber"), "Widget logs the selected account")
  assert.ok(!widgetEntry.includes("customerNumber: settings.customerNumber"), "Widget logs the customer number")
  assert.ok(!http.includes('json?.message ?? ""'), "raw API error details are logged")
  assert.ok(http.includes("safeAPIErrorMessage"), "API errors are not converted to a privacy-safe message")
})

test("fresh Widget preview does not fabricate a personal data snapshot", () => {
  assert.ok(widgetSettings.includes("const previewData = readWidgetCache()"), "preview does not read cache directly")
  assert.ok(!widgetSettings.includes("createPreviewData"), "preview still fabricates account data")
  assert.ok(widgetSettings.includes("<EmptyWidgetPreview"), "fresh preview does not render an empty state")

  const personalSnapshotMarkers = [
    ["101", ".79"].join(""),
    ["78", ".9"].join(""),
    ["48", ".62"].join(""),
    ["3", ".93"].join(""),
    ["84", ".00"].join(""),
  ]
  const publishableFixtures = `${widgetSettings}\n${billingTests}`
  for (const marker of personalSnapshotMarkers) {
    assert.ok(!publishableFixtures.includes(marker), `publishable source contains private preview value ${marker}`)
  }
})

test("publishable tariff defaults do not reveal the user's locality", () => {
  for (const marker of ["清远", "清城区", "清新区", "佛冈县", "英德市", "阳山县", "QINGYUAN", "Qingyuan"]) {
    assert.ok(!tariff.includes(marker), `tariff source contains locality marker: ${marker}`)
  }
  assert.ok(tariff.includes("DEFAULT_RESIDENT_TARIFF"), "generic resident tariff fallback is missing")
})
