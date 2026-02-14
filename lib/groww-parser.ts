/**
 * Groww CSV parser for importing investment data.
 * Supports:
 * - Groww Stock Order History CSV
 * - Groww Stock Holdings Statement CSV
 * - Groww Mutual Fund Holdings CSV
 * - Groww MF Order History CSV
 */

export interface ParsedStockHolding {
  symbol: string
  exchange: string
  shares: number
  averageCost: number
  isin?: string
  stockName?: string
}

export interface ParsedStockTransaction {
  stockName: string
  symbol: string
  isin: string
  type: "BUY" | "SELL"
  quantity: number
  value: number
  exchange: string
  executionDate: string
  orderStatus: string
}

export interface ParsedMutualFundHolding {
  schemeName: string
  amc: string
  category: string
  subCategory: string
  folioNumber: string
  source: string
  units: number
  investedValue: number
  currentValue: number
  returns: number
  xirr: string | null
}

export interface ParsedMutualFundTransaction {
  schemeName: string
  transactionType: string
  units: number
  nav: number
  amount: number
  date: string
}

export interface ParsedSIP {
  name: string
  provider: string
  monthlyAmount: number
  startDate: string
  status: "active" | "paused" | "cancelled"
}

export type CSVFormatType =
  | "groww-stock-order-history"
  | "groww-stock-holdings"
  | "groww-mf-holdings"
  | "groww-mf-order-history"
  | "custom-stocks"
  | "custom-sips"
  | "unknown"

/**
 * Parse CSV text into rows, handling quoted fields properly.
 */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let current = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(current)
      current = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++
      row.push(current)
      if (row.some((cell) => cell.trim() !== "")) rows.push(row)
      row = []
      current = ""
      continue
    }

    current += char
  }

  if (current.length || row.length) {
    row.push(current)
    if (row.some((cell) => cell.trim() !== "")) rows.push(row)
  }

  return rows
}

/**
 * Detect CSV format from headers.
 */
export function detectCSVFormat(headers: string[]): CSVFormatType {
  const normalized = headers.map((h) => h.trim().toLowerCase())

  if (
    normalized.includes("stock name") &&
    normalized.includes("symbol") &&
    normalized.includes("order status")
  ) {
    return "groww-stock-order-history"
  }

  if (
    normalized.includes("stock name") &&
    normalized.includes("average buy price") &&
    !normalized.includes("symbol")
  ) {
    return "groww-stock-holdings"
  }

  if (
    normalized.includes("scheme name") &&
    normalized.includes("units") &&
    normalized.includes("invested value") &&
    normalized.includes("current value")
  ) {
    return "groww-mf-holdings"
  }

  if (
    normalized.includes("scheme name") &&
    normalized.includes("transaction type") &&
    normalized.includes("amount") &&
    normalized.includes("date")
  ) {
    return "groww-mf-order-history"
  }

  if (
    normalized.includes("symbol") &&
    normalized.includes("exchange") &&
    normalized.includes("shares")
  ) {
    return "custom-stocks"
  }

  if (
    normalized.includes("name") &&
    normalized.includes("provider") &&
    normalized.includes("monthlyamount")
  ) {
    return "custom-sips"
  }

  return "unknown"
}

/**
 * Detect SIPs from MF order history.
 * Looks for schemes with 2+ PURCHASE transactions with similar amounts.
 */
export function detectSIPsFromMFOrders(
  transactions: ParsedMutualFundTransaction[]
): ParsedSIP[] {
  const purchases = transactions.filter(
    (t) => t.transactionType.toUpperCase() === "PURCHASE"
  )

  const schemeMap = new Map<string, { amounts: number[]; dates: string[] }>()
  for (const txn of purchases) {
    const entry = schemeMap.get(txn.schemeName) || { amounts: [], dates: [] }
    entry.amounts.push(txn.amount)
    entry.dates.push(txn.date)
    schemeMap.set(txn.schemeName, entry)
  }

  const sips: ParsedSIP[] = []
  schemeMap.forEach((entry, schemeName) => {
    if (entry.amounts.length < 2) return

    const avgAmount =
      entry.amounts.reduce((a, b) => a + b, 0) / entry.amounts.length
    const roundedAmount = Math.round(avgAmount / 100) * 100 || Math.round(avgAmount)
    const sortedDates = [...entry.dates].sort()

    sips.push({
      name: schemeName,
      provider: "Groww",
      monthlyAmount: roundedAmount,
      startDate: sortedDates[0] || "",
      status: "active",
    })
  })

  return sips
}

/**
 * Match bank transactions to SIP deductions.
 * Looks for transactions containing Groww-related keywords
 * and matches by date proximity.
 */
export interface SIPDeductionMatch {
  sipName: string
  sipAmount: number
  sipDay: number
  bankTransaction: {
    date: string
    description: string
    amount: number
  }
  dateProximity: number // days difference
  matched: boolean
}

const GROWW_KEYWORDS = [
  "groww",
  "groww.iccl",
  "groww.brk",
  "mutual f",
  "billdesk groww",
  "razorpay groww",
  "ng-groww",
  "nextbillion groww",
]

/**
 * Check if a bank transaction description matches Groww-related keywords.
 */
export function isGrowwTransaction(description: string): boolean {
  const lower = description.toLowerCase()
  return GROWW_KEYWORDS.some((keyword) => lower.includes(keyword))
}

/**
 * Match SIP deductions from bank transactions.
 *
 * @param bankTransactions Array of bank transactions
 * @param sips Array of registered SIPs
 * @param dateToleranceDays Maximum days difference for matching (default 3)
 */
export function matchSIPDeductions(
  bankTransactions: Array<{ date: string; description: string; amount: number }>,
  sips: Array<{ name: string; monthlyAmount: number; startDate: string }>,
  dateToleranceDays: number = 3
): { matched: SIPDeductionMatch[]; unmatched: Array<{ date: string; description: string; amount: number }> } {
  const growwTxns = bankTransactions.filter((txn) => isGrowwTransaction(txn.description))
  const matched: SIPDeductionMatch[] = []
  const usedTxnIndices = new Set<number>()

  for (const sip of sips) {
    const sipStartDate = new Date(sip.startDate)
    if (isNaN(sipStartDate.getTime())) continue

    const sipDay = sipStartDate.getDate()

    for (let i = 0; i < growwTxns.length; i++) {
      if (usedTxnIndices.has(i)) continue

      const txn = growwTxns[i]
      const txnDate = new Date(txn.date)
      if (isNaN(txnDate.getTime())) continue

      const txnDay = txnDate.getDate()
      const dayDiff = Math.abs(txnDay - sipDay)
      const amountMatch =
        Math.abs(txn.amount - sip.monthlyAmount) < sip.monthlyAmount * 0.1 // 10% tolerance

      if (dayDiff <= dateToleranceDays && amountMatch) {
        usedTxnIndices.add(i)
        matched.push({
          sipName: sip.name,
          sipAmount: sip.monthlyAmount,
          sipDay,
          bankTransaction: txn,
          dateProximity: dayDiff,
          matched: true,
        })
      }
    }
  }

  const unmatched = growwTxns.filter((_, i) => !usedTxnIndices.has(i))

  return { matched, unmatched }
}
