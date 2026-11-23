import {
  JSON_KEY_AREA_CODE,
  JSON_KEY_ELE_CUST_ID,
  JSON_KEY_METERING_POINT_ID,
  JSON_KEY_METERING_POINT_NUMBER,
  JSON_KEY_YEAR_MONTH,
} from "../constants"
import {
  getAuthToken,
  normalizeAccountSelection,
  patchSettings,
  readSettings,
  readWidgetCache,
  saveWidgetCache,
} from "../storage"
import type { CSGAccount, LadderInfo, MonthDayRecord, StoredSettings, WidgetData } from "../types"
import { requestJSON } from "../api/http"
import { getCustomerNumber } from "../api/auth"
import { probeOfficialBillList, selectOfficialBillAmounts } from "./billing"
import {
  evaluateCachePolicy,
  extractChargeTotal,
  extractDatedDayRecord,
  extractLadderInfo,
  extractMonthTotalKwh,
  extractSurplusValues,
  extractYesterdayKwh,
  formatDateKey,
  pickLatestDayRecord,
  shouldFetchBillData,
} from "./data_normalizer"

const FAST_API_TIMEOUT_MS = 8000
const SLOW_API_TIMEOUT_MS = 8000

export async function syncLinkedAccounts() {
  const settings = readSettings()
  const authToken = getAuthToken()
  if (!authToken) {
    throw new Error("请先扫码登录。")
  }

  console.log("[CSG] syncLinkedAccounts:start")

  const customerNumber = settings.customerNumber ?? await getCustomerNumber(authToken)
  console.log("[CSG] syncLinkedAccounts:customerNumber", "present", Boolean(customerNumber))
  const rawAccounts = await requestJSON<any[]>("eleCustNumber/queryBindEleUsers", {}, {
    authToken,
    customerNumber,
  })
  console.log("[CSG] syncLinkedAccounts:rawAccounts", rawAccounts.length)

  const linkedAccounts: CSGAccount[] = []

  for (const item of rawAccounts) {
    console.log("[CSG] syncLinkedAccounts:queryMeteringPoint")
    const meteringPoints = await requestJSON<any[]>("charge/queryMeteringPoint", {
      [JSON_KEY_AREA_CODE]: item.areaCode,
      eleCustNumberList: [
        {
          [JSON_KEY_ELE_CUST_ID]: item.bindingId,
          [JSON_KEY_AREA_CODE]: item.areaCode,
        },
      ],
    }, {
      authToken,
      customerNumber,
    })

    const firstPoint = meteringPoints[0]
    if (!firstPoint) {
      continue
    }

    linkedAccounts.push({
      accountNumber: item.eleCustNumber,
      areaCode: item.areaCode,
      eleCustomerId: item.bindingId,
      meteringPointId: firstPoint[JSON_KEY_METERING_POINT_ID],
      meteringPointNumber: firstPoint[JSON_KEY_METERING_POINT_NUMBER],
      address: item.eleAddress,
      userName: item.userName,
    })
  }

  const normalizedSelection = normalizeAccountSelection({
    ...settings,
    linkedAccounts,
  })

  patchSettings({
    linkedAccounts,
    ...normalizedSelection,
    customerNumber,
    lastSyncAt: new Date().toISOString(),
  })

  console.log("[CSG] syncLinkedAccounts:done", linkedAccounts.length)

  return linkedAccounts
}

export async function fetchWidgetData(settings: StoredSettings): Promise<WidgetData> {
  console.log("[CSG] fetchWidgetData:start")
  const authToken = getAuthToken()
  if (!authToken) {
    throw new Error("未登录，请先在脚本中完成扫码登录。")
  }
  console.log("[CSG] fetchWidgetData:hasAuthToken", true)

  const account = resolveSelectedAccount(settings)
  if (!account) {
    throw new Error("未配置有效的缴费号。")
  }
  console.log("[CSG] fetchWidgetData:account", "selected")

  const customerNumber = settings.customerNumber ?? await getCustomerNumber(authToken)
  console.log("[CSG] fetchWidgetData:customerNumber", "present", Boolean(customerNumber))
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const yearMonth = `${year}${month.toString().padStart(2, "0")}`
  const previousMonthDate = new Date(year, month - 2, 1)
  const previousYearMonth = `${previousMonthDate.getFullYear()}${`${previousMonthDate.getMonth() + 1}`.padStart(2, "0")}`
  const yesterdayDay = new Date(year, month - 1, now.getDate() - 1)
  const yesterdayDateKey = formatDateKey(yesterdayDay)
  const yesterdayYearMonth = `${yesterdayDay.getFullYear()}${`${yesterdayDay.getMonth() + 1}`.padStart(2, "0")}`
  const cached = readWidgetCache()
  if (cached) {
    console.log("[CSG] fetchWidgetData:cacheFound", cached.refreshedAt)
  }
  const cacheDecision = evaluateCachePolicy(cached, now, account.accountNumber)
  console.log("[CSG] fetchWidgetData:cacheDecision", cacheDecision)
  if (cacheDecision.useCache && cached && cached.account.accountNumber === account.accountNumber) {
    console.log("[CSG] fetchWidgetData:returnCached", cacheDecision.reason)
    return cached
  }
  const fetchBills = shouldFetchBillData(cached, now, account.accountNumber)
  console.log("[CSG] fetchWidgetData:billFetchAllowed", fetchBills)

  const [surplusResult, monthUsageResult, yesterdayResult, yesterdayCalendarResult, monthCalendarResult, monthChargeData, previousMonthChargeData] = await Promise.all([
    settleRequest("queryUserAccountNumberSurplus", withTimeout(requestJSON<any[]>("charge/queryUserAccountNumberSurplus", {
      [JSON_KEY_AREA_CODE]: account.areaCode,
      [JSON_KEY_ELE_CUST_ID]: account.eleCustomerId,
    }, {
      authToken,
      customerNumber,
      timeout: FAST_API_TIMEOUT_MS / 1000,
    }), FAST_API_TIMEOUT_MS, "queryUserAccountNumberSurplus")),
    settleRequest("queryDayElectricByMPoint", withTimeout(requestJSON<any>("charge/queryDayElectricByMPoint", {
      [JSON_KEY_AREA_CODE]: account.areaCode,
      [JSON_KEY_ELE_CUST_ID]: account.eleCustomerId,
      [JSON_KEY_YEAR_MONTH]: yearMonth,
      [JSON_KEY_METERING_POINT_ID]: account.meteringPointId,
    }, {
      authToken,
      customerNumber,
      timeout: FAST_API_TIMEOUT_MS / 1000,
    }), FAST_API_TIMEOUT_MS, "queryDayElectricByMPoint")),
    settleRequest("queryDayElectricByMPointYesterday", withTimeout(requestJSON<any>("charge/queryDayElectricByMPointYesterday", {
      [JSON_KEY_AREA_CODE]: account.areaCode,
      [JSON_KEY_ELE_CUST_ID]: account.eleCustomerId,
    }, {
      authToken,
      customerNumber,
      timeout: FAST_API_TIMEOUT_MS / 1000,
    }), FAST_API_TIMEOUT_MS, "queryDayElectricByMPointYesterday")),
    // 南网已陆续下线昨日专用接口（sta=02）。参考 ha-csg-enhanced 的做法，
    // 用仍在维护的日历接口取昨日所属月份的每日电量，按日期匹配昨日记录。
    settleRequest("queryElectricityCalendar", withTimeout(requestJSON<any>("charge/queryElectricityCalendar", {
      [JSON_KEY_AREA_CODE]: account.areaCode,
      [JSON_KEY_ELE_CUST_ID]: account.eleCustomerId,
      [JSON_KEY_YEAR_MONTH]: yesterdayYearMonth,
      [JSON_KEY_METERING_POINT_ID]: account.meteringPointId,
      deviceIdentif: account.meteringPointNumber || account.meteringPointId,
    }, {
      authToken,
      customerNumber,
      timeout: FAST_API_TIMEOUT_MS / 1000,
    }), FAST_API_TIMEOUT_MS, "queryElectricityCalendar")),
    // 每日明细/每日电费旧接口同样已下线（sta=02），本月用电改用日历接口兜底：
    // 取本月每日电量，汇总得到本月累计用电，并恢复最新一天记录。
    settleRequest("queryElectricityCalendarMonth", withTimeout(requestJSON<any>("charge/queryElectricityCalendar", {
      [JSON_KEY_AREA_CODE]: account.areaCode,
      [JSON_KEY_ELE_CUST_ID]: account.eleCustomerId,
      [JSON_KEY_YEAR_MONTH]: yearMonth,
      [JSON_KEY_METERING_POINT_ID]: account.meteringPointId,
      deviceIdentif: account.meteringPointNumber || account.meteringPointId,
    }, {
      authToken,
      customerNumber,
      timeout: FAST_API_TIMEOUT_MS / 1000,
    }), FAST_API_TIMEOUT_MS, "queryElectricityCalendarMonth")),
    fetchBills ? withTimeout(
      requestJSON<any>("charge/queryDayElectricChargeByMPoint", {
        [JSON_KEY_AREA_CODE]: account.areaCode,
        [JSON_KEY_ELE_CUST_ID]: account.eleCustomerId,
        [JSON_KEY_YEAR_MONTH]: yearMonth,
        [JSON_KEY_METERING_POINT_ID]: account.meteringPointId,
      }, {
        authToken,
        customerNumber,
        timeout: SLOW_API_TIMEOUT_MS / 1000,
      }),
      SLOW_API_TIMEOUT_MS,
      "queryDayElectricChargeByMPoint",
    ).catch((error) => {
      console.log("[CSG] fetchWidgetData:monthChargeData:failed", String((error as Error)?.message ?? error))
      return null
    }) : Promise.resolve(null),
    fetchBills ? withTimeout(
      requestJSON<any>("charge/queryDayElectricChargeByMPoint", {
        [JSON_KEY_AREA_CODE]: account.areaCode,
        [JSON_KEY_ELE_CUST_ID]: account.eleCustomerId,
        [JSON_KEY_YEAR_MONTH]: previousYearMonth,
        [JSON_KEY_METERING_POINT_ID]: account.meteringPointId,
      }, {
        authToken,
        customerNumber,
        timeout: SLOW_API_TIMEOUT_MS / 1000,
      }),
      SLOW_API_TIMEOUT_MS,
      "queryPreviousMonthChargeByMPoint",
    ).catch((error) => {
      console.log("[CSG] fetchWidgetData:previousMonthCharge:failed", String((error as Error)?.message ?? error))
      return null
    }) : Promise.resolve(null),
  ])
  const surplusList = surplusResult.ok ? surplusResult.data : null
  const monthUsageData = monthUsageResult.ok ? monthUsageResult.data : null
  const yesterday = yesterdayResult.ok ? yesterdayResult.data : null
  const yesterdayCalendarData = yesterdayCalendarResult.ok ? yesterdayCalendarResult.data : null
  const monthCalendarData = monthCalendarResult.ok ? monthCalendarResult.data : null

  console.log("[CSG] fetchWidgetData:surplusLoaded", surplusList?.length ?? 0)
  console.log("[CSG] fetchWidgetData:monthUsageLoaded", Array.isArray(monthUsageData?.result) ? monthUsageData.result.length : 0)
  console.log("[CSG] fetchWidgetData:yesterdayLoaded", yesterday?.power != null)
  console.log("[CSG] fetchWidgetData:yesterdayCalendarLoaded", yesterdayCalendarData != null)
  console.log("[CSG] fetchWidgetData:monthCalendarLoaded", monthCalendarData != null)
  console.log("[CSG] fetchWidgetData:monthChargeLoaded", monthChargeData != null)
  console.log("[CSG] fetchWidgetData:previousMonthChargeLoaded", previousMonthChargeData != null)

  const primaryMonthTotalCharge = extractChargeTotal(monthChargeData)
  const primaryPreviousMonthCharge = extractChargeTotal(previousMonthChargeData)
  let officialBillAmounts: Partial<Record<string, number>> = {}
  if (fetchBills && (primaryMonthTotalCharge == null || primaryPreviousMonthCharge == null)) {
    const officialBillData = await probeOfficialBillList(requestJSON, {
      account,
      authToken,
      customerNumber,
      yearMonths: [yearMonth, previousYearMonth],
    })
    officialBillAmounts = selectOfficialBillAmounts(officialBillData, [yearMonth, previousYearMonth])
  }

  if (!surplusList && !monthUsageData && !yesterday && !yesterdayCalendarData && !monthCalendarData && !monthChargeData && !previousMonthChargeData
    && Object.keys(officialBillAmounts).length === 0) {
    if (cached && cached.account.accountNumber === account.accountNumber) {
      console.log("[CSG] fetchWidgetData:fallbackAllCached")
      return {
        ...cached,
        refreshedAt: cached.refreshedAt,
      }
    }
    throw new Error("所有数据请求都失败，且没有可用缓存。")
  }

  const surplus = extractSurplusValues(surplusList)
  const latestDay = pickLatestDayRecord(monthChargeData ?? monthUsageData)
    ?? pickLatestDayRecord(monthCalendarData)
    ?? cached?.latestDay ?? null
  const normalizedLadder = extractLadderInfo(monthChargeData)
  const ladder = hasLadderValues(normalizedLadder) ? normalizedLadder : (cached?.ladder ?? emptyLadder())
  const monthTotalCharge = primaryMonthTotalCharge ?? officialBillAmounts[yearMonth] ?? cached?.monthTotalCharge ?? null
  const previousMonthCharge = primaryPreviousMonthCharge ?? officialBillAmounts[previousYearMonth] ?? cached?.previousMonthCharge ?? null
  const monthTotalKwh = extractMonthTotalKwh(monthChargeData)
    ?? extractMonthTotalKwh(monthUsageData)
    ?? extractMonthTotalKwh(monthCalendarData)
    ?? cached?.monthTotalKwh ?? null

  // 昨日电量取值链：原昨日接口 → 日历接口（昨日所属月份）→ 每日明细接口。
  // 带日期的来源按昨日精确匹配；南网 T+3 发布导致昨日缺失时，回退到已发布的最新一天。
  const legacyYesterdayKwh = extractYesterdayKwh(yesterday)
  const yesterdayRecord = legacyYesterdayKwh != null
    ? { date: yesterdayDateKey, kwh: legacyYesterdayKwh }
    : extractDatedDayRecord(yesterdayCalendarData, yesterdayDateKey)
      ?? extractDatedDayRecord(monthUsageData, yesterdayDateKey)
      ?? extractDatedDayRecord(monthChargeData, yesterdayDateKey)
  const cachedYesterdayKwh = cached && (cached.yesterdayDate == null || cached.yesterdayDate === yesterdayDateKey)
    ? cached.yesterdayKwh
    : null
  const yesterdayKwh = yesterdayRecord?.kwh ?? cachedYesterdayKwh ?? null
  const yesterdayDate = yesterdayRecord?.date
    ?? (cachedYesterdayKwh != null ? cached?.yesterdayDate ?? null : null)

  const result: WidgetData = {
    account,
    balance: surplus.balance ?? cached?.balance ?? 0,
    arrears: surplus.arrears ?? cached?.arrears ?? 0,
    monthTotalCharge,
    previousMonthCharge,
    monthTotalKwh,
    ladder,
    latestDay,
    yesterdayKwh,
    yesterdayDate,
    refreshedAt: new Date().toISOString(),
    lastBillAttemptAt: fetchBills ? now.toISOString() : cached?.lastBillAttemptAt ?? null,
  }

  patchSettings({
    customerNumber,
    selectedAccount: account,
    paymentNumber: settings.paymentNumber || account.accountNumber,
    lastSyncAt: new Date().toISOString(),
  })

  console.log("[CSG] fetchWidgetData:done", {
    hasBalance: result.balance != null,
    hasArrears: result.arrears != null,
    hasMonthTotalCharge: monthTotalCharge != null,
    hasPreviousMonthCharge: previousMonthCharge != null,
    hasMonthTotalKwh: monthTotalKwh != null,
    hasLatestDay: latestDay != null,
  })

  saveWidgetCache(result)
  console.log("[CSG] fetchWidgetData:cacheSaved", result.refreshedAt)

  return result
}

export function shouldSkipRemoteFetch(settings: StoredSettings) {
  const account = resolveSelectedAccount(settings)
  if (!account) {
    return {
      skip: false,
      reason: "no-selected-account",
    }
  }

  const decision = evaluateCachePolicy(readWidgetCache(), new Date(), account.accountNumber)
  return {
    skip: decision.useCache,
    reason: decision.reason,
  }
}

function resolveSelectedAccount(settings: StoredSettings) {
  const paymentNumber = settings.paymentNumber.trim()
  if (paymentNumber) {
    return settings.linkedAccounts.find((item) => item.accountNumber === paymentNumber)
      ?? (settings.selectedAccount?.accountNumber === paymentNumber ? settings.selectedAccount : null)
  }
  return settings.selectedAccount
}

function emptyLadder(): LadderInfo {
  return {
    ladder: null,
    remainingKwh: null,
    tariff: null,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} 超时（>${timeoutMs}ms）`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

async function settleRequest<T>(label: string, promise: Promise<T>) {
  try {
    const data = await promise
    console.log("[CSG] settleRequest:ok", label)
    return {
      ok: true as const,
      data,
    }
  } catch (error: any) {
    console.log("[CSG] settleRequest:failed", label, String(error?.message ?? error))
    return {
      ok: false as const,
      error,
    }
  }
}

function hasLadderValues(ladder: LadderInfo) {
  return ladder.ladder != null || ladder.remainingKwh != null || ladder.tariff != null
}
