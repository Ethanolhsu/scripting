import assert from "node:assert/strict"
import test from "node:test"

const normalizerUrl = new URL("../scripts/南方电网/services/data_normalizer.ts", import.meta.url)

test("normalizes nested balance and arrears values", async () => {
  const { extractSurplusValues } = await import(normalizerUrl)

  assert.deepEqual(extractSurplusValues({
    result: {
      rows: [{ accountBalance: "￥1,234.56", oweFee: "0.00元" }],
    },
  }), {
    balance: 1234.56,
    arrears: 0,
  })
})

test("uses direct monthly usage or sums valid daily records", async () => {
  const { extractMonthTotalKwh } = await import(normalizerUrl)

  assert.equal(extractMonthTotalKwh({ totalKwh: "78.90 kWh" }), 78.9)
  assert.equal(extractMonthTotalKwh({
    totalPower: "78.90",
    result: [{ date: "2026-07-15", power: "4.25" }],
  }), 78.9)
  assert.equal(extractMonthTotalKwh({
    pageData: {
      records: [
        { dataDate: "2026-07-15", dayPower: "4.25" },
        { dataDate: "2026-07-14", dayPower: "3.75" },
        { dataDate: "", dayPower: "999" },
      ],
    },
  }), 8)
})

test("selects the newest daily record regardless of API order", async () => {
  const { pickLatestDayRecord } = await import(normalizerUrl)

  assert.deepEqual(pickLatestDayRecord({
    rows: [
      { dataDate: "2026-07-15", dayPower: "4.25", dayCharge: "2.10" },
      { dataDate: "20260716", electricity: "5.50", electricityCharge: "2.75" },
      { dataDate: "2026-07-14", dayPower: "3.75", dayCharge: "1.90" },
    ],
  }), {
    date: "2026-07-16",
    charge: 2.75,
    kwh: 5.5,
  })
})

test("normalizes yesterday usage, charge totals, and ladder variants", async () => {
  const {
    extractChargeTotal,
    extractLadderInfo,
    extractYesterdayKwh,
  } = await import(normalizerUrl)

  assert.equal(extractYesterdayKwh({ data: { list: [{ statDate: "20260715", electricity: "4.25" }] } }), 4.25)
  assert.equal(extractChargeTotal({ result: { totalCharge: "￥88.66" } }), 88.66)
  assert.equal(extractChargeTotal({
    totalElectricity: "88.66",
    result: [{ date: "2026-07-15", charge: "2.10" }],
  }), 88.66)
  assert.deepEqual(extractLadderInfo({
    data: {
      currentLadder: "2",
      remainingPower: "125.5 kWh",
      ladderPrice: "0.62元",
    },
  }), {
    ladder: 2,
    remainingKwh: 125.5,
    tariff: 0.62,
  })
})

test("retries incomplete cache after a bounded quiet period", async () => {
  const { evaluateCachePolicy } = await import(normalizerUrl)
  const cached = {
    account: { accountNumber: "DEMO_ACCOUNT" },
    balance: 10,
    arrears: 0,
    monthTotalCharge: null,
    previousMonthCharge: null,
    monthTotalKwh: 20,
    ladder: { ladder: null, remainingKwh: null, tariff: null },
    latestDay: { date: "2026-07-15", charge: 0, kwh: 4 },
    yesterdayKwh: 4,
    refreshedAt: "2026-07-16T08:00:00.000Z",
  }

  assert.deepEqual(evaluateCachePolicy(cached, new Date("2026-07-16T08:20:00.000Z"), "DEMO_ACCOUNT"), {
    useCache: true,
    reason: "recent-incomplete-cache",
  })
  assert.deepEqual(evaluateCachePolicy(cached, new Date("2026-07-16T10:00:00.000Z"), "DEMO_ACCOUNT"), {
    useCache: false,
    reason: "incomplete-cache-retry",
  })
})

test("throttles all bill probes behind a six-hour cooldown", async () => {
  const { shouldFetchBillData } = await import(normalizerUrl)
  const cached = {
    account: { accountNumber: "DEMO_ACCOUNT" },
    lastBillAttemptAt: "2026-07-16T08:00:00.000Z",
  }

  assert.equal(shouldFetchBillData(cached, new Date("2026-07-16T13:59:59.000Z"), "DEMO_ACCOUNT"), false)
  assert.equal(shouldFetchBillData(cached, new Date("2026-07-16T14:00:00.000Z"), "DEMO_ACCOUNT"), true)
  assert.equal(shouldFetchBillData(cached, new Date("2026-07-16T08:01:00.000Z"), "OTHER_ACCOUNT"), true)
  assert.equal(shouldFetchBillData(null, new Date("2026-07-16T08:01:00.000Z"), "DEMO_ACCOUNT"), true)
})
