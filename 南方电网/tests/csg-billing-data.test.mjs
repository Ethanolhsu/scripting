import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const billingModuleUrl = new URL("../scripts/南方电网/services/billing.ts", import.meta.url)
const powerSource = readFileSync(new URL("../scripts/南方电网/services/power.ts", import.meta.url), "utf8")

test("summarizes official bill response shape without logging values", async () => {
  const { summarizeBillResponseShape } = await import(billingModuleUrl)

  assert.deepEqual(summarizeBillResponseShape([
    { billMonth: "202606", totalCharge: "56.78", accountNumber: "secret" },
  ]), {
    container: "array",
    itemCount: 1,
    itemKeys: ["accountNumber", "billMonth", "totalCharge"],
  })
  assert.deepEqual(summarizeBillResponseShape({ result: [{ month: "202607", amount: 12.34 }] }), {
    container: "object",
    itemCount: 1,
    itemKeys: ["amount", "month"],
  })
  assert.deepEqual(summarizeBillResponseShape({
    billList: [{ electricityBillYearMonth: "202606", totalElectricity: "56.78" }],
  }), {
    container: "object",
    itemCount: 1,
    itemKeys: ["electricityBillYearMonth", "totalElectricity"],
  })
  assert.deepEqual(summarizeBillResponseShape(null), {
    container: "null",
    itemCount: 0,
    itemKeys: [],
  })
})

test("falls back to the second official bill endpoint", async () => {
  const { probeOfficialBillList } = await import(billingModuleUrl)
  const calls = []
  const expected = {
    billUserAndYear: [
      { electricityBillYearMonth: "202607", totalElectricity: "12.34" },
      { electricityBillYearMonth: "202606", totalElectricity: "56.78" },
    ],
  }
  const request = async (path, payload) => {
    calls.push({ path, payload })
    if (path === "charge/queryEleBills") {
      throw new Error("primary unavailable")
    }
    return expected
  }

  const result = await probeOfficialBillList(request, {
    account: {
      accountNumber: "DEMO_ACCOUNT",
      areaCode: "031800",
      eleCustomerId: "customer-id",
      meteringPointId: "point-id",
      meteringPointNumber: "point-number",
      address: "",
      userName: "",
    },
    authToken: "token",
    customerNumber: "customer-number",
    yearMonths: ["202607", "202606"],
  })

  assert.equal(result, expected)
  assert.deepEqual(calls.map((item) => item.path), [
    "charge/queryEleBills",
    "charge/selectElecBill",
  ])
  assert.deepEqual(calls[0].payload, {
    areaCode: "031800",
    eleCustId: "customer-id",
    startTime: "202606",
    endTime: "202607",
    queryType: "2",
    pageNum: 1,
    pageSize: 24,
  })
  assert.deepEqual(calls[1].payload, {
    eleCustId: "customer-id",
    electricityBillYear: "2026",
    areaCode: "031800",
    pageNum: 1,
    pageSize: 24,
  })
})

test("falls back when the first endpoint has no requested billing month", async () => {
  const { probeOfficialBillList, selectOfficialBillAmounts } = await import(billingModuleUrl)
  const calls = []
  const expected = {
    billUserAndYear: [
      { electricityBillYearMonth: "202607", totalElectricity: "12.34" },
      { electricityBillYearMonth: "202606", totalElectricity: "56.78" },
    ],
  }
  const request = async (path) => {
    calls.push(path)
    return path === "charge/queryEleBills"
      ? { billList: [{ electricityBillYearMonth: "202501", totalElectricity: "12.00" }] }
      : expected
  }

  const result = await probeOfficialBillList(request, {
    account: {
      accountNumber: "account",
      areaCode: "031800",
      eleCustomerId: "customer-id",
      meteringPointId: "point-id",
      meteringPointNumber: "point-number",
      address: "",
      userName: "",
    },
    authToken: "token",
    customerNumber: "customer-number",
    yearMonths: ["202607", "202606"],
  })

  assert.deepEqual(selectOfficialBillAmounts(result, ["202607", "202606"]), {
    "202607": 12.34,
    "202606": 56.78,
  })
  assert.deepEqual(calls, ["charge/queryEleBills", "charge/selectElecBill"])
})

test("selects official bill amounts by billing month", async () => {
  const { selectOfficialBillAmounts } = await import(billingModuleUrl)
  const result = selectOfficialBillAmounts({
    billList: [
      { electricityBillYearMonth: "202607", totalElectricity: "12.34" },
      { startMonthDate: "2026-06", totalElectricity: 56.78 },
      { electricityBillYearMonth: "202605", totalElectricity: "not-a-number" },
    ],
  }, ["202607", "202606"])

  assert.deepEqual(result, {
    "202607": 12.34,
    "202606": 56.78,
  })
})

test("normalizes nested official bill pages and formatted amounts", async () => {
  const { selectOfficialBillAmounts, summarizeBillResponseShape } = await import(billingModuleUrl)
  const response = {
    pageData: {
      records: [
        { billYearMonth: "2026年07月", payableAmount: "￥1,234.50" },
        { chargeMonth: "2026/06/01", receivableAmount: "56.78元" },
      ],
    },
  }

  assert.deepEqual(selectOfficialBillAmounts(response, ["202607", "202606"]), {
    "202607": 1234.5,
    "202606": 56.78,
  })
  assert.deepEqual(summarizeBillResponseShape(response), {
    container: "object",
    itemCount: 2,
    itemKeys: ["billYearMonth", "payableAmount"],
  })
})

test("keeps October through December billing months intact", async () => {
  const { selectOfficialBillAmounts } = await import(billingModuleUrl)

  assert.deepEqual(selectOfficialBillAmounts({
    records: [
      { yearMonth: "2026-10-01", totalCharge: "10.10" },
      { yearMonth: "202611", totalCharge: "11.11" },
      { yearMonth: "2026年12月", totalCharge: "12.12" },
    ],
  }, ["202610", "202611", "202612"]), {
    "202610": 10.1,
    "202611": 11.11,
    "202612": 12.12,
  })
})

test("keeps probing until every requested month is collected", async () => {
  const { probeOfficialBillList, selectOfficialBillAmounts } = await import(billingModuleUrl)
  const calls = []
  const request = async (path) => {
    calls.push(path)
    if (path === "charge/queryEleBills") {
      return { records: [{ billMonth: "202607", totalCharge: "12.34" }] }
    }
    if (path === "charge/selectElecBill") {
      return { rows: [{ billMonth: "202606", totalCharge: "56.78" }] }
    }
    throw new Error("third endpoint should not be needed")
  }

  const raw = await probeOfficialBillList(request, {
    account: {
      accountNumber: "DEMO_ACCOUNT",
      areaCode: "031800",
      eleCustomerId: "customer-id",
      meteringPointId: "point-id",
      meteringPointNumber: "point-number",
      address: "",
      userName: "",
    },
    authToken: "token",
    customerNumber: "customer-number",
    yearMonths: ["202607", "202606"],
  })

  assert.deepEqual(calls, ["charge/queryEleBills", "charge/selectElecBill"])
  assert.deepEqual(selectOfficialBillAmounts(raw, ["202607", "202606"]), {
    "202607": 12.34,
    "202606": 56.78,
  })
})

test("uses the third official bill endpoint when earlier probes fail", async () => {
  const { probeOfficialBillList, selectOfficialBillAmounts } = await import(billingModuleUrl)
  const calls = []
  const request = async (path) => {
    calls.push(path)
    if (path !== "charge/selectElecBillList") throw new Error("unavailable")
    return {
      list: [
        { settleMonth: "202607", billAmount: "12.34" },
        { settleMonth: "202606", billAmount: "56.78" },
      ],
    }
  }

  const raw = await probeOfficialBillList(request, {
    account: {
      accountNumber: "DEMO_ACCOUNT",
      areaCode: "031800",
      eleCustomerId: "customer-id",
      meteringPointId: "point-id",
      meteringPointNumber: "point-number",
      address: "",
      userName: "",
    },
    authToken: "token",
    customerNumber: "customer-number",
    yearMonths: ["202607", "202606"],
  })

  assert.deepEqual(calls, [
    "charge/queryEleBills",
    "charge/selectElecBill",
    "charge/selectElecBillList",
  ])
  assert.deepEqual(selectOfficialBillAmounts(raw, ["202607", "202606"]), {
    "202607": 12.34,
    "202606": 56.78,
  })
})

test("probes official bills only when primary charge totals are missing", () => {
  assert.ok(powerSource.includes('import { probeOfficialBillList, selectOfficialBillAmounts } from "./billing"'))
  assert.ok(powerSource.includes("primaryMonthTotalCharge == null || primaryPreviousMonthCharge == null"))
  assert.ok(powerSource.includes("await probeOfficialBillList(requestJSON"))
  assert.ok(powerSource.includes("yearMonths: [yearMonth, previousYearMonth]"))
  assert.ok(powerSource.includes("selectOfficialBillAmounts(officialBillData, [yearMonth, previousYearMonth])"))
  assert.ok(powerSource.includes("primaryMonthTotalCharge ?? officialBillAmounts[yearMonth] ?? cached?.monthTotalCharge ?? null"))
  assert.ok(powerSource.includes("primaryPreviousMonthCharge ?? officialBillAmounts[previousYearMonth] ?? cached?.previousMonthCharge ?? null"))
  assert.ok(powerSource.includes("Object.keys(officialBillAmounts).length === 0"))
  assert.ok(powerSource.includes("const fetchBills = shouldFetchBillData(cached, now, account.accountNumber)"))
  assert.ok(powerSource.includes("fetchBills && (primaryMonthTotalCharge == null || primaryPreviousMonthCharge == null)"))
  assert.ok(powerSource.includes("lastBillAttemptAt: fetchBills ? now.toISOString() : cached?.lastBillAttemptAt ?? null"))
})
