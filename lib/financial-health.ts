/**
 * Financial Health Metrics Engine
 *
 * Provides composite scoring, trend analysis, and financial health indicators
 * including emergency fund ratio, expense velocity, income profiling,
 * financial freedom scoring, and net worth timeline construction.
 */

import type {
  Transaction,
  ExpenseVelocity,
  NetWorthPoint,
  IncomeProfile,
} from './types';
import { TransactionType } from './types';
import { sum, average, isCompletedStatus, getMonthKey, toDate } from './utils';

/**
 * Calculate the emergency fund ratio (months of expenses covered).
 *
 * @param currentBalance - Current bank balance
 * @param avgMonthlyExpense - Average monthly expense amount
 * @returns Number of months the current balance can cover
 */
export function calculateEmergencyFundRatio(
  currentBalance: number,
  avgMonthlyExpense: number
): number {
  if (avgMonthlyExpense <= 0) return 0;
  return currentBalance / avgMonthlyExpense;
}

/**
 * Calculate expense velocity by comparing the most recent 3 months
 * of expenses against the preceding 3 months.
 *
 * @param monthlyTrends - Array of monthly data with month key and expenses
 * @returns ExpenseVelocity with current/previous averages, change %, and trend
 */
export function calculateExpenseVelocity(
  monthlyTrends: { month: string; expenses: number }[]
): ExpenseVelocity {
  // Take the last 6 months of data
  const recent = monthlyTrends.slice(-6);

  if (recent.length < 2) {
    return {
      currentMonthlyAvg: recent.length === 1 ? recent[0].expenses : 0,
      previousMonthlyAvg: 0,
      changePercent: 0,
      trend: 'stable',
    };
  }

  // Split into two halves: previous (older) and current (newer)
  const midpoint = Math.floor(recent.length / 2);
  const previousSlice = recent.slice(0, midpoint);
  const currentSlice = recent.slice(midpoint);

  const currentMonthlyAvg = average(currentSlice.map(m => m.expenses));
  const previousMonthlyAvg = average(previousSlice.map(m => m.expenses));

  const changePercent =
    previousMonthlyAvg > 0
      ? ((currentMonthlyAvg - previousMonthlyAvg) / previousMonthlyAvg) * 100
      : 0;

  let trend: ExpenseVelocity['trend'] = 'stable';
  if (changePercent > 5) trend = 'increasing';
  else if (changePercent < -5) trend = 'decreasing';

  return {
    currentMonthlyAvg,
    previousMonthlyAvg,
    changePercent,
    trend,
  };
}

/**
 * Calculate a composite Financial Freedom Score (0-100).
 *
 * Breakdown:
 *   - Savings rate: 0-25 points
 *   - Emergency fund: 0-25 points
 *   - NWI adherence: 0-25 points
 *   - Investment rate: 0-25 points
 *
 * @param metrics - Input metrics for scoring
 * @returns Composite score and per-category breakdown
 */
export function calculateFinancialFreedomScore(metrics: {
  savingsRate: number;
  emergencyFundMonths: number;
  nwiAdherence: number;
  investmentRate: number;
}): {
  score: number;
  breakdown: {
    savingsRate: number;
    emergencyFund: number;
    nwiAdherence: number;
    investmentRate: number;
  };
} {
  // Savings rate scoring (0-25)
  let savingsRateScore: number;
  if (metrics.savingsRate > 30) savingsRateScore = 25;
  else if (metrics.savingsRate > 20) savingsRateScore = 20;
  else if (metrics.savingsRate > 10) savingsRateScore = 15;
  else if (metrics.savingsRate > 0) savingsRateScore = 10;
  else savingsRateScore = 0;

  // Emergency fund scoring (0-25)
  let emergencyFundScore: number;
  if (metrics.emergencyFundMonths > 6) emergencyFundScore = 25;
  else if (metrics.emergencyFundMonths > 3) emergencyFundScore = 20;
  else if (metrics.emergencyFundMonths > 1) emergencyFundScore = 10;
  else emergencyFundScore = 0;

  // NWI adherence scoring (0-25): input is 0-100, divide by 4
  const nwiAdherenceScore = Math.min(25, Math.max(0, metrics.nwiAdherence / 4));

  // Investment rate scoring (0-25)
  let investmentRateScore: number;
  if (metrics.investmentRate > 20) investmentRateScore = 25;
  else if (metrics.investmentRate > 15) investmentRateScore = 20;
  else if (metrics.investmentRate > 10) investmentRateScore = 15;
  else if (metrics.investmentRate > 5) investmentRateScore = 10;
  else if (metrics.investmentRate > 0) investmentRateScore = 5;
  else investmentRateScore = 0;

  const score =
    savingsRateScore + emergencyFundScore + nwiAdherenceScore + investmentRateScore;

  return {
    score,
    breakdown: {
      savingsRate: savingsRateScore,
      emergencyFund: emergencyFundScore,
      nwiAdherence: nwiAdherenceScore,
      investmentRate: investmentRateScore,
    },
  };
}

/**
 * Merge monthly bank balances with monthly investment values to produce
 * a net worth timeline.
 *
 * @param monthlyBalances - Bank balance snapshots per month
 * @param investmentValues - Investment value snapshots per month
 * @returns Sorted array of NetWorthPoint entries
 */
export function calculateNetWorthTimeline(
  monthlyBalances: { month: string; balance: number }[],
  investmentValues: { month: string; value: number }[]
): NetWorthPoint[] {
  // Build lookup maps
  const balanceMap = new Map<string, number>();
  for (const entry of monthlyBalances) {
    balanceMap.set(entry.month, entry.balance);
  }

  const investmentMap = new Map<string, number>();
  for (const entry of investmentValues) {
    investmentMap.set(entry.month, entry.value);
  }

  // Collect all unique months
  const allMonths = new Set<string>();
  balanceMap.forEach((_v, k) => allMonths.add(k));
  investmentMap.forEach((_v, k) => allMonths.add(k));

  const timeline: NetWorthPoint[] = Array.from(allMonths).map(month => {
    const bankBalance = balanceMap.get(month) ?? 0;
    const investmentValue = investmentMap.get(month) ?? 0;
    return {
      month,
      bankBalance,
      investmentValue,
      totalNetWorth: bankBalance + investmentValue,
    };
  });

  // Sort chronologically by month key (YYYY-MM format)
  return timeline.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Detect income patterns from transaction history.
 *
 * Calculates average monthly income, stability (inverse of coefficient of
 * variation), whether income is variable, and the most recent income date.
 *
 * @param transactions - Full transaction list
 * @returns IncomeProfile with stability analysis
 */
export function detectIncome(transactions: Transaction[]): IncomeProfile {
  // Filter to completed income transactions
  const incomeTransactions = transactions.filter(
    t => t.type === TransactionType.INCOME && isCompletedStatus(t.status)
  );

  if (incomeTransactions.length === 0) {
    return {
      avgMonthlyIncome: 0,
      incomeStability: 0,
      isVariable: true,
      lastIncomeDate: null,
    };
  }

  // Group by month and sum
  const monthlyMap = new Map<string, number>();
  for (const txn of incomeTransactions) {
    const monthKey = getMonthKey(txn.date);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + txn.amount);
  }

  const monthlyTotals = Array.from(monthlyMap.values());
  const avgMonthlyIncome = average(monthlyTotals);

  // Calculate coefficient of variation (stddev / mean)
  let incomeStability = 0;
  if (avgMonthlyIncome > 0 && monthlyTotals.length > 1) {
    const variance =
      sum(monthlyTotals.map(v => (v - avgMonthlyIncome) ** 2)) /
      monthlyTotals.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / avgMonthlyIncome;
    incomeStability = Math.max(0, 1 - cv);
  } else if (monthlyTotals.length === 1) {
    // Single month of data -- cannot determine variability
    incomeStability = 1;
  }

  const isVariable = incomeStability < 0.7;

  // Most recent income date
  const sorted = [...incomeTransactions].sort(
    (a, b) => toDate(b.date).getTime() - toDate(a.date).getTime()
  );
  const lastIncomeDate = toDate(sorted[0].date).toISOString();

  return {
    avgMonthlyIncome,
    incomeStability,
    isVariable,
    lastIncomeDate,
  };
}
