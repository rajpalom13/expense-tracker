/**
 * Monthly calculation utilities for finance dashboard
 * Handles month-based filtering, balance tracking, and metrics calculation
 *
 * This library provides production-ready utilities for:
 * - Filtering transactions by month
 * - Calculating opening/closing balances
 * - Computing comprehensive monthly metrics
 * - Handling edge cases (partial months, empty data, etc.)
 */

import { Transaction, TransactionType } from './types';
import { isCompletedStatus } from './utils';

/**
 * Month identifier interface
 */
export interface MonthIdentifier {
  year: number;
  month: number; // 1-12 (1 = January, 12 = December)
  label: string; // "January 2026"
}

/**
 * Comprehensive monthly metrics interface
 */
export interface MonthlyMetrics {
  year: number;
  month: number;
  monthLabel: string;

  // Balance tracking (from running balance in sheet)
  openingBalance: number;
  closingBalance: number;

  // Income & Expenses (from transaction amounts)
  totalIncome: number;
  totalExpenses: number;

  // Derived metrics
  netChange: number; // closingBalance - openingBalance (actual balance change)
  netSavings: number; // totalIncome - totalExpenses (transaction-based savings)
  growthRate: number; // (netChange / openingBalance) * 100
  savingsRate: number; // (netSavings / totalIncome) * 100

  // Transaction counts
  transactionCount: number;
  incomeTransactionCount: number;
  expenseTransactionCount: number;

  // Period information
  startDate: Date;
  endDate: Date;
  isPartialMonth: boolean;
  daysInPeriod: number;
}

/**
 * Round currency to 2 decimal places
 * Prevents floating point errors in calculations
 */
function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Round percentage to 2 decimal places
 */
function roundPercentage(percentage: number): number {
  return Math.round(percentage * 100) / 100;
}

/**
 * Get all transactions for a specific month
 *
 * @param transactions - All transactions (dates can be Date objects or strings)
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12, where 1 = January)
 * @returns Filtered transactions for the month
 *
 * @example
 * const janTransactions = getMonthTransactions(transactions, 2026, 1);
 */
export function getMonthTransactions(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  if (year < 1900 || year > 2100) {
    console.warn(`Invalid year: ${year}. Expected 1900-2100.`);
    return [];
  }

  if (month < 1 || month > 12) {
    console.warn(`Invalid month: ${month}. Expected 1-12.`);
    return [];
  }

  return transactions.filter(t => {
    try {
      const date = new Date(t.date);
      // Check for invalid date
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date in transaction: ${t.date}`);
        return false;
      }
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    } catch (error) {
      console.warn(`Error parsing date for transaction:`, error);
      return false;
    }
  });
}

/**
 * Get opening balance for a specific month
 *
 * This is the balance at the END of the previous month.
 * If it's the first month, calculate from the first transaction.
 *
 * @param transactions - All transactions (should be complete dataset)
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Opening balance for the month
 *
 * @example
 * const openingBalance = getMonthOpeningBalance(transactions, 2026, 1);
 * // Returns: 71000 (balance before Jan 1 first transaction)
 */
export function getMonthOpeningBalance(
  transactions: Transaction[],
  year: number,
  month: number
): number {
  if (!transactions || transactions.length === 0) {
    return 0;
  }

  const filtered = transactions.filter(t => isCompletedStatus(t.status));
  if (filtered.length === 0) {
    return 0;
  }

  // Sort transactions by date ascending
  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  // Find the last transaction of the previous month
  const previousMonthEnd = new Date(year, month - 1, 0); // Last day of previous month
  const previousTransactions = sorted.filter(t => {
    const date = new Date(t.date);
    return date <= previousMonthEnd;
  });

  if (previousTransactions.length > 0) {
    // Return last known balance from previous month
    const lastWithBalance = [...previousTransactions]
      .reverse()
      .find(t => t.balance !== undefined && t.balance !== null);
    if (lastWithBalance) {
      const numericBalance = Number(lastWithBalance.balance);
      return Number.isFinite(numericBalance) ? numericBalance : 0;
    }
  }

  // If no previous transactions, find first transaction of this month
  const thisMonthTransactions = getMonthTransactions(sorted, year, month);
  if (thisMonthTransactions.length > 0) {
    // For first transaction of first month, calculate opening balance
    // by working backwards from the first transaction's balance
    const firstTxn = thisMonthTransactions.find(
      t => t.balance !== undefined && t.balance !== null
    ) || thisMonthTransactions[0];
    const firstBalance = Number(firstTxn.balance ?? 0);
    const firstAmount = firstTxn.amount ?? 0;

    if (firstTxn.type === TransactionType.INCOME) {
      // If it was income, opening = balance - amount
      return firstBalance - firstAmount;
    } else if (firstTxn.type === TransactionType.EXPENSE) {
      // If it was expense, opening = balance + amount
      return firstBalance + firstAmount;
    } else {
      // For other types (transfer, etc.), use the balance as-is
      return firstBalance;
    }
  }

  return 0;
}

/**
 * Get closing balance for a specific month
 *
 * This is the balance at the END of the month (from last transaction).
 *
 * @param transactions - All transactions
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Closing balance for the month
 *
 * @example
 * const closingBalance = getMonthClosingBalance(transactions, 2026, 1);
 * // Returns: 41817 (balance after last transaction of January)
 */
export function getMonthClosingBalance(
  transactions: Transaction[],
  year: number,
  month: number
): number {
  const monthTransactions = getMonthTransactions(
    transactions.filter(t => isCompletedStatus(t.status)),
    year,
    month
  );

  if (monthTransactions.length === 0) {
    // No transactions this month, return opening balance
    return getMonthOpeningBalance(transactions, year, month);
  }

  // Sort by date descending and get last known balance
  const sorted = [...monthTransactions].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  const lastWithBalance = sorted.find(
    t => t.balance !== undefined && t.balance !== null
  );
  if (lastWithBalance) {
    const numericBalance = Number(lastWithBalance.balance);
    return Number.isFinite(numericBalance) ? numericBalance : 0;
  }

  return getMonthOpeningBalance(transactions, year, month);
}

/**
 * Check if a month has partial data (doesn't span full calendar month)
 *
 * A month is considered partial if:
 * - First transaction is not on the 1st of the month, OR
 * - Last transaction is not on the last day of the month
 *
 * @param transactions - All transactions
 * @param year - Year
 * @param month - Month (1-12)
 * @returns True if partial month
 *
 * @example
 * const isPartial = isPartialMonth(transactions, 2026, 1);
 * // Returns: true (Jan 1-24, not full month)
 */
export function isPartialMonth(
  transactions: Transaction[],
  year: number,
  month: number
): boolean {
  const monthTransactions = getMonthTransactions(transactions, year, month);

  if (monthTransactions.length === 0) {
    return false;
  }

  // Get first and last transaction dates
  const sorted = [...monthTransactions].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  const firstDate = new Date(sorted[0].date);
  const lastDate = new Date(sorted[sorted.length - 1].date);

  // Get last day of the month
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  // Check if first transaction is not on 1st OR last transaction is not on last day
  return firstDate.getDate() !== 1 || lastDate.getDate() !== lastDayOfMonth;
}

/**
 * Get number of days in a month's transaction period
 *
 * Calculates the span from first to last transaction (inclusive).
 *
 * @param transactions - All transactions
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Number of days with transactions
 *
 * @example
 * const days = getMonthPeriodDays(transactions, 2026, 1);
 * // Returns: 24 (Jan 1-24)
 */
export function getMonthPeriodDays(
  transactions: Transaction[],
  year: number,
  month: number
): number {
  const monthTransactions = getMonthTransactions(transactions, year, month);

  if (monthTransactions.length === 0) {
    return 0;
  }

  const sorted = [...monthTransactions].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  const firstDate = new Date(sorted[0].date);
  const lastDate = new Date(sorted[sorted.length - 1].date);

  const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days

  return diffDays;
}

/**
 * Calculate comprehensive monthly metrics
 *
 * Computes all financial metrics for a given month including:
 * - Opening/closing balances
 * - Income and expenses
 * - Net change and savings
 * - Growth and savings rates
 * - Transaction counts
 * - Period information
 *
 * @param transactions - All transactions
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Complete monthly metrics
 *
 * @example
 * const metrics = calculateMonthlyMetrics(transactions, 2026, 1);
 * console.log(`${metrics.monthLabel}: ${metrics.netChange}`);
 */
export function calculateMonthlyMetrics(
  transactions: Transaction[],
  year: number,
  month: number
): MonthlyMetrics {
  const monthTransactions = getMonthTransactions(transactions, year, month);
  const sorted = [...monthTransactions].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  // Balance calculations (from running balance)
  const openingBalance = getMonthOpeningBalance(transactions, year, month);
  const closingBalance = getMonthClosingBalance(transactions, year, month);
  const netChange = closingBalance - openingBalance;

  // Income & Expense calculations (from transaction amounts)
  // Only count completed transactions
  const incomeTransactions = monthTransactions.filter(
    t => t.type === TransactionType.INCOME && isCompletedStatus(t.status)
  );
  const expenseTransactions = monthTransactions.filter(
    t => t.type === TransactionType.EXPENSE && isCompletedStatus(t.status)
  );

  const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const netSavings = totalIncome - totalExpenses;

  // Rates with zero-division protection
  const growthRate = openingBalance !== 0
    ? (netChange / Math.abs(openingBalance)) * 100
    : 0;

  const rawSavingsRate = totalIncome !== 0
    ? (netSavings / totalIncome) * 100
    : 0;
  const savingsRate = Math.max(-100, Math.min(100, rawSavingsRate));

  // Period information
  let startDate: Date;
  let endDate: Date;

  if (sorted.length > 0) {
    startDate = new Date(sorted[0].date);
    endDate = new Date(sorted[sorted.length - 1].date);
  } else {
    // No transactions in month, use first and last day of month
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0); // Last day of month
  }

  const isPartial = isPartialMonth(transactions, year, month);
  const daysInPeriod = getMonthPeriodDays(transactions, year, month);

  // Month label
  const monthLabel = formatMonthLabel(year, month);

  return {
    year,
    month,
    monthLabel,
    openingBalance: roundCurrency(openingBalance),
    closingBalance: roundCurrency(closingBalance),
    totalIncome: roundCurrency(totalIncome),
    totalExpenses: roundCurrency(totalExpenses),
    netChange: roundCurrency(netChange),
    netSavings: roundCurrency(netSavings),
    growthRate: roundPercentage(growthRate),
    savingsRate: roundPercentage(savingsRate),
    transactionCount: monthTransactions.length,
    incomeTransactionCount: incomeTransactions.length,
    expenseTransactionCount: expenseTransactions.length,
    startDate,
    endDate,
    isPartialMonth: isPartial,
    daysInPeriod
  };
}

/**
 * Get list of all available months from transactions
 *
 * @param transactions - All transactions
 * @returns Array of month identifiers, sorted chronologically (oldest first)
 *
 * @example
 * const months = getAvailableMonths(transactions);
 * // Returns: [{ year: 2026, month: 1, label: "January 2026" }]
 */
export function getAvailableMonths(
  transactions: Transaction[]
): MonthIdentifier[] {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const monthSet = new Set<string>();

  transactions.forEach(t => {
    try {
      if (!isCompletedStatus(t.status)) {
        return;
      }
      const date = new Date(t.date);
      if (isNaN(date.getTime())) {
        return; // Skip invalid dates
      }
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthSet.add(key);
    } catch (error) {
      console.warn('Error processing transaction date:', error);
    }
  });

  const months: MonthIdentifier[] = Array.from(monthSet)
    .sort()
    .map(key => {
      const [year, month] = key.split('-').map(Number);
      const label = formatMonthLabel(year, month);
      return { year, month, label };
    });

  return months;
}

/**
 * Get current month identifier
 *
 * @returns Current year and month
 *
 * @example
 * const current = getCurrentMonth();
 * // Returns: { year: 2026, month: 1, label: "January 2026" }
 */
export function getCurrentMonth(): MonthIdentifier {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const label = formatMonthLabel(year, month);

  return { year, month, label };
}

/**
 * Format month as "January 2026"
 *
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Formatted month label
 *
 * @example
 * const label = formatMonthLabel(2026, 1);
 * // Returns: "January 2026"
 */
export function formatMonthLabel(year: number, month: number): string {
  try {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    console.warn(`Error formatting month label for ${year}-${month}:`, error);
    return `${year}-${String(month).padStart(2, '0')}`;
  }
}

/**
 * Compare two month identifiers
 *
 * @param a - First month
 * @param b - Second month
 * @returns True if months are equal
 */
export function isSameMonth(a: MonthIdentifier, b: MonthIdentifier): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Get previous month
 *
 * @param current - Current month identifier
 * @returns Previous month identifier
 *
 * @example
 * const prev = getPreviousMonth({ year: 2026, month: 1, label: "January 2026" });
 * // Returns: { year: 2025, month: 12, label: "December 2025" }
 */
export function getPreviousMonth(current: MonthIdentifier): MonthIdentifier {
  let { year, month } = current;
  month--;
  if (month === 0) {
    month = 12;
    year--;
  }

  const label = formatMonthLabel(year, month);

  return { year, month, label };
}

/**
 * Get next month
 *
 * @param current - Current month identifier
 * @returns Next month identifier
 *
 * @example
 * const next = getNextMonth({ year: 2026, month: 1, label: "January 2026" });
 * // Returns: { year: 2026, month: 2, label: "February 2026" }
 */
export function getNextMonth(current: MonthIdentifier): MonthIdentifier {
  let { year, month } = current;
  month++;
  if (month === 13) {
    month = 1;
    year++;
  }

  const label = formatMonthLabel(year, month);

  return { year, month, label };
}

/**
 * Calculate month-over-month growth
 *
 * @param transactions - All transactions
 * @param currentYear - Current year
 * @param currentMonth - Current month
 * @returns Growth metrics vs previous month
 *
 * @example
 * const growth = calculateMonthOverMonthGrowth(transactions, 2026, 2);
 * console.log(`Income growth: ${growth.incomeGrowth}%`);
 */
export function calculateMonthOverMonthGrowth(
  transactions: Transaction[],
  currentYear: number,
  currentMonth: number
): {
  incomeGrowth: number;
  expenseGrowth: number;
  balanceGrowth: number;
  savingsGrowth: number;
} {
  const current = calculateMonthlyMetrics(transactions, currentYear, currentMonth);
  const prevMonth = getPreviousMonth({ year: currentYear, month: currentMonth, label: '' });
  const previous = calculateMonthlyMetrics(transactions, prevMonth.year, prevMonth.month);

  const incomeGrowth = previous.totalIncome !== 0
    ? ((current.totalIncome - previous.totalIncome) / previous.totalIncome) * 100
    : 0;

  const expenseGrowth = previous.totalExpenses !== 0
    ? ((current.totalExpenses - previous.totalExpenses) / previous.totalExpenses) * 100
    : 0;

  const balanceGrowth = previous.closingBalance !== 0
    ? ((current.closingBalance - previous.closingBalance) / Math.abs(previous.closingBalance)) * 100
    : 0;

  const savingsGrowth = previous.netSavings !== 0
    ? ((current.netSavings - previous.netSavings) / Math.abs(previous.netSavings)) * 100
    : 0;

  return {
    incomeGrowth: roundPercentage(incomeGrowth),
    expenseGrowth: roundPercentage(expenseGrowth),
    balanceGrowth: roundPercentage(balanceGrowth),
    savingsGrowth: roundPercentage(savingsGrowth)
  };
}

/**
 * Format currency for display
 *
 * @param amount - Amount to format
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(41816.55);
 * // Returns: "₹41,816.55"
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Format compact currency (for large numbers)
 *
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "₹1.5L")
 *
 * @example
 * formatCurrencyCompact(150000);
 * // Returns: "₹1.50L"
 */
export function formatCurrencyCompact(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(2)}K`;
  }
  return `₹${amount.toFixed(2)}`;
}

// ============================================================================
// Helper Functions (Internal)
// ============================================================================
