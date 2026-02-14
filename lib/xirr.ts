/**
 * XIRR (Extended Internal Rate of Return) calculator.
 * Uses Newton-Raphson method to find the annualized return rate
 * for irregular cash flows.
 */

export interface CashFlow {
  date: Date
  amount: number // Negative for investments (outflows), positive for redemptions/current value
}

/**
 * Calculate the Net Present Value (NPV) for a set of cash flows at a given rate.
 */
function npv(cashFlows: CashFlow[], rate: number): number {
  const baseDate = cashFlows[0].date
  let total = 0
  for (const cf of cashFlows) {
    const years = (cf.date.getTime() - baseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    total += cf.amount / Math.pow(1 + rate, years)
  }
  return total
}

/**
 * Calculate the derivative of NPV with respect to rate.
 */
function npvDerivative(cashFlows: CashFlow[], rate: number): number {
  const baseDate = cashFlows[0].date
  let total = 0
  for (const cf of cashFlows) {
    const years = (cf.date.getTime() - baseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (years === 0) continue
    total -= years * cf.amount / Math.pow(1 + rate, years + 1)
  }
  return total
}

/**
 * Calculate XIRR using Newton-Raphson method.
 *
 * @param cashFlows Array of cash flows with dates and amounts.
 *   - Investments (money going out) should be negative
 *   - Redemptions/Current value should be positive
 * @param guess Initial guess for rate (default 0.1 = 10%)
 * @param tolerance Convergence tolerance (default 1e-7)
 * @param maxIterations Maximum iterations (default 100)
 * @returns Annualized rate of return as a decimal (0.12 = 12%), or null if no convergence
 */
export function calculateXIRR(
  cashFlows: CashFlow[],
  guess: number = 0.1,
  tolerance: number = 1e-7,
  maxIterations: number = 100
): number | null {
  if (cashFlows.length < 2) return null

  // Sort by date
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime())

  // Need at least one positive and one negative cash flow
  const hasNegative = sorted.some((cf) => cf.amount < 0)
  const hasPositive = sorted.some((cf) => cf.amount > 0)
  if (!hasNegative || !hasPositive) return null

  let rate = guess

  for (let i = 0; i < maxIterations; i++) {
    const f = npv(sorted, rate)
    const fPrime = npvDerivative(sorted, rate)

    if (Math.abs(fPrime) < 1e-12) {
      // Derivative too small, try a different approach
      // Use bisection fallback
      return bisectionXIRR(sorted, tolerance, maxIterations)
    }

    const newRate = rate - f / fPrime

    if (Math.abs(newRate - rate) < tolerance) {
      return Math.round(newRate * 10000) / 10000
    }

    // Clamp to prevent extreme values
    rate = Math.max(-0.99, Math.min(newRate, 100))
  }

  // Newton-Raphson did not converge, try bisection
  return bisectionXIRR(sorted, tolerance, maxIterations * 2)
}

/**
 * Bisection fallback for XIRR when Newton-Raphson fails.
 */
function bisectionXIRR(
  cashFlows: CashFlow[],
  tolerance: number,
  maxIterations: number
): number | null {
  let low = -0.99
  let high = 10.0

  let fLow = npv(cashFlows, low)
  let fHigh = npv(cashFlows, high)

  // Ensure the root is bracketed
  if (fLow * fHigh > 0) {
    // Try wider range
    high = 100
    fHigh = npv(cashFlows, high)
    if (fLow * fHigh > 0) return null
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2
    const fMid = npv(cashFlows, mid)

    if (Math.abs(fMid) < tolerance || (high - low) / 2 < tolerance) {
      return Math.round(mid * 10000) / 10000
    }

    if (fMid * fLow < 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }

  return null
}

/**
 * Convenience function: Calculate XIRR from investment transactions and current value.
 *
 * @param investments Array of { date, amount } where amount is the invested amount (positive number)
 * @param currentValue Current portfolio value
 * @param currentDate Date for the current value (defaults to today)
 * @returns XIRR as a percentage (e.g., 12.5 means 12.5%), or null
 */
export function calculateInvestmentXIRR(
  investments: Array<{ date: Date; amount: number }>,
  currentValue: number,
  currentDate: Date = new Date()
): number | null {
  if (investments.length === 0 || currentValue <= 0) return null

  const cashFlows: CashFlow[] = investments.map((inv) => ({
    date: inv.date,
    amount: -Math.abs(inv.amount), // Outflows are negative
  }))

  // Add current value as the final positive cash flow
  cashFlows.push({
    date: currentDate,
    amount: currentValue,
  })

  const rate = calculateXIRR(cashFlows)
  if (rate === null) return null

  return Math.round(rate * 10000) / 100 // Convert to percentage
}

/**
 * Calculate simple annualized return (CAGR) as a fallback.
 */
export function calculateCAGR(
  investedAmount: number,
  currentValue: number,
  startDate: Date,
  endDate: Date = new Date()
): number {
  if (investedAmount <= 0 || currentValue <= 0) return 0

  const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years < 0.01) return 0

  const cagr = (Math.pow(currentValue / investedAmount, 1 / years) - 1) * 100
  return Math.round(cagr * 100) / 100
}
