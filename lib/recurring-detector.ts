/**
 * Enhanced Recurring Transaction Detection
 *
 * Detects recurring patterns from transaction history with confidence scoring,
 * subscription detection, and next-date prediction.
 */

import type { Transaction } from "@/lib/types"

export interface RecurringPattern {
  merchant: string
  category: string
  averageAmount: number
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "annual"
  confidence: number // 0-1
  lastDate: string
  nextExpectedDate: string
  occurrences: number
  totalSpent: number
  isSubscription: boolean
  amountVariance: number // % variance in amounts
}

// Subscription-like categories
const SUBSCRIPTION_CATEGORIES = new Set([
  "Entertainment",
  "Utilities",
  "Insurance",
  "Subscription",
  "Education",
  "Fitness",
  "Healthcare",
])

interface FrequencySpec {
  label: RecurringPattern["frequency"]
  idealDays: number
  tolerance: number // days
  advanceDays: number
}

const FREQUENCY_SPECS: FrequencySpec[] = [
  { label: "weekly", idealDays: 7, tolerance: 1, advanceDays: 7 },
  { label: "biweekly", idealDays: 14, tolerance: 2, advanceDays: 14 },
  { label: "monthly", idealDays: 30, tolerance: 3, advanceDays: 30 },
  { label: "quarterly", idealDays: 90, tolerance: 7, advanceDays: 90 },
  { label: "annual", idealDays: 365, tolerance: 15, advanceDays: 365 },
]

function normalizeMerchant(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ")
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function classifyFrequency(
  intervals: number[]
): { spec: FrequencySpec; intervalConsistency: number } | null {
  if (intervals.length === 0) return null

  const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length

  // Find the best matching frequency spec
  let bestSpec: FrequencySpec | null = null
  let bestScore = Infinity

  for (const spec of FREQUENCY_SPECS) {
    const distance = Math.abs(avgInterval - spec.idealDays)
    if (distance <= spec.tolerance * 2 && distance < bestScore) {
      bestScore = distance
      bestSpec = spec
    }
  }

  if (!bestSpec) return null

  // Calculate interval consistency (how tightly intervals cluster around the ideal)
  const deviations = intervals.map((d) => Math.abs(d - bestSpec!.idealDays))
  const avgDeviation = deviations.reduce((s, d) => s + d, 0) / deviations.length
  const maxAllowed = bestSpec.tolerance * 2
  const intervalConsistency = Math.max(0, 1 - avgDeviation / maxAllowed)

  return { spec: bestSpec, intervalConsistency }
}

function calculateConfidence(
  occurrences: number,
  intervalConsistency: number,
  amountVariance: number
): number {
  // Occurrence score: ramps up from 3 to 6+ occurrences
  const occurrenceScore = Math.min(1, (occurrences - 2) / 4)

  // Interval score: directly from consistency
  const intervalScore = intervalConsistency

  // Amount score: low variance = high score
  const amountScore = Math.max(0, 1 - amountVariance / 50) // 50% variance = 0 score

  // Weighted combination
  const confidence =
    occurrenceScore * 0.3 + intervalScore * 0.4 + amountScore * 0.3

  return Math.round(confidence * 100) / 100
}

export function detectRecurringTransactions(
  transactions: Transaction[]
): RecurringPattern[] {
  // Step 1: Group by normalized merchant name
  const groups = new Map<
    string,
    { originalMerchant: string; items: Transaction[] }
  >()

  for (const txn of transactions) {
    if (txn.type !== "expense") continue
    const rawText = txn.merchant || txn.description
    if (!rawText) continue
    const key = normalizeMerchant(rawText)
    if (!key || key.length < 2) continue

    const existing = groups.get(key)
    if (existing) {
      existing.items.push(txn)
    } else {
      groups.set(key, { originalMerchant: rawText, items: [txn] })
    }
  }

  const results: RecurringPattern[] = []

  for (const [, group] of groups) {
    const { items, originalMerchant } = group

    // Step 2: Need 3+ transactions
    if (items.length < 3) continue

    // Sort by date ascending
    const sorted = [...items].sort(
      (a, b) =>
        new Date(a.date as unknown as string).getTime() -
        new Date(b.date as unknown as string).getTime()
    )

    // Step 3: Calculate intervals
    const dates = sorted.map((t) => {
      const d = t.date instanceof Date ? t.date.toISOString() : String(t.date)
      return d.split("T")[0]
    })

    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push(daysBetween(dates[i - 1], dates[i]))
    }

    // Classify frequency
    const freqResult = classifyFrequency(intervals)
    if (!freqResult) continue

    // Calculate amount statistics
    const amounts = sorted.map((t) => t.amount)
    const totalSpent = amounts.reduce((s, a) => s + a, 0)
    const averageAmount = totalSpent / amounts.length
    if (averageAmount === 0) continue

    const amountStdDev = Math.sqrt(
      amounts.reduce((s, a) => s + (a - averageAmount) ** 2, 0) / amounts.length
    )
    const amountVariance = (amountStdDev / averageAmount) * 100

    // Calculate confidence
    const confidence = calculateConfidence(
      sorted.length,
      freqResult.intervalConsistency,
      amountVariance
    )

    // Only include patterns with reasonable confidence
    if (confidence < 0.3) continue

    const lastDate = dates[dates.length - 1]
    const nextExpectedDate = addDays(lastDate, freqResult.spec.advanceDays)

    // Determine most common category
    const catCounts = new Map<string, number>()
    for (const t of sorted) {
      const cat = String(t.category)
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1)
    }
    let category = String(sorted[0].category)
    let topCount = 0
    for (const [cat, count] of catCounts) {
      if (count > topCount) {
        category = cat
        topCount = count
      }
    }

    // Check if likely a subscription
    const isSubscription =
      SUBSCRIPTION_CATEGORIES.has(category) ||
      amountVariance < 5 // Very consistent amounts suggest subscription

    results.push({
      merchant: originalMerchant,
      category,
      averageAmount: Math.round(averageAmount * 100) / 100,
      frequency: freqResult.spec.label,
      confidence,
      lastDate,
      nextExpectedDate,
      occurrences: sorted.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      isSubscription,
      amountVariance: Math.round(amountVariance * 100) / 100,
    })
  }

  // Sort by next expected date ascending
  results.sort(
    (a, b) =>
      new Date(a.nextExpectedDate).getTime() -
      new Date(b.nextExpectedDate).getTime()
  )

  return results
}
