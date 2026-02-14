/**
 * Analytics engine for financial data analysis
 * Provides functions for aggregations, trends, and insights
 */

import {
  Transaction,
  TransactionType,
  TransactionCategory,
  PaymentMethod,
  Analytics,
  CategoryBreakdown,
  PaymentMethodBreakdown,
  MonthlyTrend,
  DailyTrend,
  CategorySummary,
  MerchantSummary,
  FinancialSummary,
} from './types';
import {
  getMonthKey,
  formatMonthYear,
  calculatePercentage,
  sum,
  average,
  groupBy,
  toDate,
  toISODateString,
  isCompletedStatus,
} from './utils';

/**
 * Calculate comprehensive analytics from transactions
 * @param transactions - Array of transactions
 * @returns Complete analytics object
 */
export function calculateAnalytics(transactions: Transaction[]): Analytics {
  // Filter only completed transactions for analytics
  const completedTransactions = transactions.filter(
    t => isCompletedStatus(t.status)
  );

  // Calculate basic totals
  const totalIncome = calculateTotalByType(
    completedTransactions,
    TransactionType.INCOME
  );
  const totalExpenses = calculateTotalByType(
    completedTransactions,
    TransactionType.EXPENSE
  );
  const netSavings = totalIncome - totalExpenses;
  const rawSavingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const savingsRate = Math.max(-100, Math.min(100, rawSavingsRate));

  // Calculate monthly averages
  const monthlyTrends = calculateMonthlyTrends(completedTransactions);
  const averageMonthlyIncome =
    monthlyTrends.length > 0
      ? average(monthlyTrends.map(m => m.income))
      : 0;
  const averageMonthlyExpense =
    monthlyTrends.length > 0
      ? average(monthlyTrends.map(m => m.expenses))
      : 0;
  const averageMonthlySavings =
    monthlyTrends.length > 0
      ? average(monthlyTrends.map(m => m.savings))
      : 0;

  // Calculate daily average spend
  const dailyAverageSpend = calculateDailyAverageSpend(completedTransactions);

  // Calculate breakdowns
  const categoryBreakdown = calculateCategoryBreakdown(completedTransactions);
  const paymentMethodBreakdown = calculatePaymentMethodBreakdown(
    completedTransactions
  );

  // Calculate top categories and merchants
  const topExpenseCategories = getTopExpenseCategories(
    completedTransactions,
    5
  );
  const topMerchants = getTopMerchants(completedTransactions, 10);

  // Calculate recurring expenses
  const recurringExpenses = calculateTotalByFilter(
    completedTransactions,
    t => t.recurring && t.type === TransactionType.EXPENSE
  );

  return {
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    averageMonthlyIncome,
    averageMonthlyExpense,
    averageMonthlySavings,
    dailyAverageSpend,
    categoryBreakdown,
    paymentMethodBreakdown,
    monthlyTrends,
    topExpenseCategories,
    topMerchants,
    recurringExpenses,
  };
}

/**
 * Calculate total amount for a specific transaction type
 * @param transactions - Array of transactions
 * @param type - Transaction type
 * @returns Total amount
 */
export function calculateTotalByType(
  transactions: Transaction[],
  type: TransactionType
): number {
  return sum(
    transactions
      .filter(t => t.type === type)
      .map(t => t.amount)
  );
}

/**
 * Calculate total amount by custom filter
 * @param transactions - Array of transactions
 * @param filter - Filter function
 * @returns Total amount
 */
export function calculateTotalByFilter(
  transactions: Transaction[],
  filter: (t: Transaction) => boolean
): number {
  return sum(
    transactions
      .filter(filter)
      .map(t => t.amount)
  );
}

/**
 * Calculate category breakdown for expenses
 * @param transactions - Array of transactions
 * @returns Category breakdown array
 */
export function calculateCategoryBreakdown(
  transactions: Transaction[]
): CategoryBreakdown[] {
  const expenses = transactions.filter(
    t => t.type === TransactionType.EXPENSE && isCompletedStatus(t.status)
  );
  const totalExpenses = sum(expenses.map(t => t.amount));

  // Group by category
  const byCategory = groupBy(expenses, 'category');

  const breakdown: CategoryBreakdown[] = Object.entries(byCategory).map(
    ([category, txns]) => {
      const amount = sum(txns.map(t => t.amount));
      return {
        category: category as TransactionCategory,
        amount,
        percentage: calculatePercentage(amount, totalExpenses),
        transactionCount: txns.length,
      };
    }
  );

  // Sort by amount descending
  return breakdown.sort((a, b) => b.amount - a.amount);
}

/**
 * Calculate payment method breakdown
 * @param transactions - Array of transactions
 * @returns Payment method breakdown array
 */
export function calculatePaymentMethodBreakdown(
  transactions: Transaction[]
): PaymentMethodBreakdown[] {
  const completed = transactions.filter(t => isCompletedStatus(t.status));
  const totalAmount = sum(completed.map(t => t.amount));

  // Group by payment method
  const byMethod = groupBy(completed, "paymentMethod");

  const breakdown: PaymentMethodBreakdown[] = Object.entries(byMethod).map(
    ([method, txns]) => {
      const amount = sum(txns.map(t => t.amount));
      return {
        method: method as PaymentMethod,
        amount,
        percentage: calculatePercentage(amount, totalAmount),
        transactionCount: txns.length,
      };
    }
  );

  // Sort by amount descending
  return breakdown.sort((a, b) => b.amount - a.amount);
}

/**
 * Calculate monthly trends
 * @param transactions - Array of transactions
 * @returns Monthly trend data
 */
export function calculateMonthlyTrends(
  transactions: Transaction[]
): MonthlyTrend[] {
  const completed = transactions.filter(t => isCompletedStatus(t.status));
  // Group transactions by month
  const byMonth: Record<string, Transaction[]> = {};

  for (const transaction of completed) {
    const monthKey = getMonthKey(transaction.date);
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = [];
    }
    byMonth[monthKey].push(transaction);
  }

  // Calculate trends for each month
  const trends: MonthlyTrend[] = Object.entries(byMonth).map(
    ([monthKey, txns]) => {
      const income = calculateTotalByType(txns, TransactionType.INCOME);
      const expenses = calculateTotalByType(txns, TransactionType.EXPENSE);
      const savings = income - expenses;

      // Parse month key to get year and month
      const [year, month] = monthKey.split('-').map(Number);
      const date = new Date(year, month - 1, 1);

      return {
        month: monthKey,
        year,
        monthName: formatMonthYear(monthKey),
        income,
        expenses,
        savings,
        savingsRate: Math.max(-100, Math.min(100, income > 0 ? (savings / income) * 100 : 0)),
        transactionCount: txns.length,
      };
    }
  );

  // Sort by month chronologically
  return trends.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculate daily trends for a specific period
 * @param transactions - Array of transactions
 * @param startDate - Start date (optional)
 * @param endDate - End date (optional)
 * @returns Daily trend data
 */
export function calculateDailyTrends(
  transactions: Transaction[],
  startDate?: Date,
  endDate?: Date
): DailyTrend[] {
  const completed = transactions.filter(t => isCompletedStatus(t.status));
  // Filter by date range if provided
  let filtered = completed;
  if (startDate && endDate) {
    filtered = completed.filter(t => {
      const txnDate = toDate(t.date);
      return txnDate >= startDate && txnDate <= endDate;
    });
  }

  // Group by date
  const byDate: Record<string, Transaction[]> = {};

  for (const transaction of filtered) {
    const dateKey = toISODateString(transaction.date);
    if (!byDate[dateKey]) {
      byDate[dateKey] = [];
    }
    byDate[dateKey].push(transaction);
  }

  // Calculate trends for each day
  const trends: DailyTrend[] = Object.entries(byDate).map(
    ([dateKey, txns]) => {
      const income = calculateTotalByType(txns, TransactionType.INCOME);
      const expenses = calculateTotalByType(txns, TransactionType.EXPENSE);

      return {
        date: dateKey,
        income,
        expenses,
        net: income - expenses,
        transactionCount: txns.length,
      };
    }
  );

  // Sort by date chronologically
  return trends.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate daily average spend
 * Divides total expenses by calendar days in the period (first to last transaction)
 * @param transactions - Array of transactions
 * @returns Daily average spend
 */
export function calculateDailyAverageSpend(
  transactions: Transaction[]
): number {
  const expenses = transactions.filter(
    t => t.type === TransactionType.EXPENSE
  );

  if (expenses.length === 0) return 0;

  const totalExpenses = sum(expenses.map(t => t.amount));

  // Use calendar days from first to last transaction (not just expense days)
  const allDates = transactions.map(t => toDate(t.date).getTime());
  const firstDate = Math.min(...allDates);
  const lastDate = Math.max(...allDates);
  const calendarDays = Math.max(
    1,
    Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1
  );

  return totalExpenses / calendarDays;
}

/**
 * Get top expense categories
 * @param transactions - Array of transactions
 * @param limit - Number of categories to return
 * @returns Top category summaries
 */
export function getTopExpenseCategories(
  transactions: Transaction[],
  limit: number = 5
): CategorySummary[] {
  const expenses = transactions.filter(
    t => t.type === TransactionType.EXPENSE
  );
  const totalExpenses = sum(expenses.map(t => t.amount));

  // Group by category
  const byCategory = groupBy(expenses, 'category');

  const summaries: CategorySummary[] = Object.entries(byCategory).map(
    ([category, txns]) => {
      const totalAmount = sum(txns.map(t => t.amount));
      return {
        category: category as TransactionCategory,
        totalAmount,
        transactionCount: txns.length,
        averageAmount: totalAmount / txns.length,
        percentageOfTotal: calculatePercentage(totalAmount, totalExpenses),
      };
    }
  );

  // Sort by total amount descending and return top N
  return summaries
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit);
}

/**
 * Get top merchants by spending
 * @param transactions - Array of transactions
 * @param limit - Number of merchants to return
 * @returns Top merchant summaries
 */
export function getTopMerchants(
  transactions: Transaction[],
  limit: number = 10
): MerchantSummary[] {
  const completed = transactions.filter(t => isCompletedStatus(t.status));
  // Group by merchant
  const byMerchant = groupBy(completed, "merchant");

  const summaries: MerchantSummary[] = Object.entries(byMerchant).map(
    ([merchant, txns]) => {
      const totalAmount = sum(txns.map(t => t.amount));

      // Find most common category
      const categoryCount: Record<string, number> = {};
      for (const txn of txns) {
        categoryCount[txn.category] = (categoryCount[txn.category] || 0) + 1;
      }
      const primaryCategory = Object.entries(categoryCount).sort(
        (a, b) => b[1] - a[1]
      )[0][0] as TransactionCategory;

      return {
        merchant,
        totalAmount,
        transactionCount: txns.length,
        averageAmount: totalAmount / txns.length,
        primaryCategory,
      };
    }
  );

  // Sort by total amount descending and return top N
  return summaries
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit);
}

/**
 * Calculate financial summary for a specific period
 * @param transactions - Array of transactions
 * @param periodName - Name of the period (e.g., "January 2024")
 * @returns Financial summary
 */
export function calculateFinancialSummary(
  transactions: Transaction[],
  periodName: string
): FinancialSummary {
  const completed = transactions.filter(t => isCompletedStatus(t.status));
  // Calculate income breakdown
  const income = completed.filter(
    t => t.type === TransactionType.INCOME
  );
  const totalIncome = sum(income.map(t => t.amount));
  const incomeByCategory = calculateCategoryBreakdownForType(
    completed,
    TransactionType.INCOME
  );

  // Calculate expense breakdown
  const expenses = completed.filter(
    t => t.type === TransactionType.EXPENSE
  );
  const totalExpenses = sum(expenses.map(t => t.amount));
  const expensesByCategory = calculateCategoryBreakdownForType(
    completed,
    TransactionType.EXPENSE
  );

  // Calculate savings
  const savings = totalIncome - totalExpenses;
  const rawSavingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
  const savingsRate = Math.max(-100, Math.min(100, rawSavingsRate));

  // Calculate transaction counts by type
  const byType: Record<TransactionType, number> = {
    [TransactionType.INCOME]: 0,
    [TransactionType.EXPENSE]: 0,
    [TransactionType.TRANSFER]: 0,
    [TransactionType.INVESTMENT]: 0,
    [TransactionType.REFUND]: 0,
  };

  for (const transaction of completed) {
    byType[transaction.type]++;
  }

  return {
    period: periodName,
    income: {
      total: totalIncome,
      byCategory: incomeByCategory,
    },
    expenses: {
      total: totalExpenses,
      byCategory: expensesByCategory,
    },
    savings: {
      total: savings,
      rate: savingsRate,
    },
    transactions: {
      total: transactions.length,
      byType,
    },
  };
}

/**
 * Calculate category breakdown for a specific transaction type
 * @param transactions - Array of transactions
 * @param type - Transaction type
 * @returns Category breakdown array
 */
function calculateCategoryBreakdownForType(
  transactions: Transaction[],
  type: TransactionType
): CategoryBreakdown[] {
  const filtered = transactions.filter(
    t => t.type === type && isCompletedStatus(t.status)
  );
  const total = sum(filtered.map(t => t.amount));

  const byCategory = groupBy(filtered, 'category');

  const breakdown: CategoryBreakdown[] = Object.entries(byCategory).map(
    ([category, txns]) => {
      const amount = sum(txns.map(t => t.amount));
      return {
        category: category as TransactionCategory,
        amount,
        percentage: calculatePercentage(amount, total),
        transactionCount: txns.length,
      };
    }
  );

  return breakdown.sort((a, b) => b.amount - a.amount);
}

/**
 * Calculate income vs expense analysis
 * @param transactions - Array of transactions
 * @returns Income vs expense data
 */
export function calculateIncomeVsExpense(transactions: Transaction[]): {
  income: number;
  expenses: number;
  difference: number;
  ratio: number;
} {
  const completed = transactions.filter(t => isCompletedStatus(t.status));
  const income = calculateTotalByType(completed, TransactionType.INCOME);
  const expenses = calculateTotalByType(completed, TransactionType.EXPENSE);
  const difference = income - expenses;
  const ratio = expenses > 0 ? income / expenses : 0;

  return {
    income,
    expenses,
    difference,
    ratio,
  };
}

/**
 * Calculate spending by category for a specific period
 * @param transactions - Array of transactions
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Category breakdown for the period
 */
export function getSpendingByPeriod(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): CategoryBreakdown[] {
  const filtered = transactions.filter(t => {
    const txnDate = toDate(t.date);
    return txnDate >= startDate && txnDate <= endDate && t.type === TransactionType.EXPENSE && isCompletedStatus(t.status);
  });

  return calculateCategoryBreakdown(filtered);
}

/**
 * Calculate year-over-year growth
 * For the current (partial) year, annualizes data by multiplying by 12/monthsElapsed
 * @param transactions - Array of transactions
 * @param year - Year to compare
 * @returns Growth percentage and annualization flag
 */
export function calculateYearOverYearGrowth(
  transactions: Transaction[],
  year: number
): {
  incomeGrowth: number;
  expenseGrowth: number;
  savingsGrowth: number;
  isAnnualized: boolean;
} {
  const completed = transactions.filter(t => isCompletedStatus(t.status));
  // Get transactions for current and previous year
  const currentYearTxns = completed.filter(
    t => toDate(t.date).getFullYear() === year
  );
  const previousYearTxns = completed.filter(
    t => toDate(t.date).getFullYear() === year - 1
  );

  // Determine if current year is partial and needs annualization
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const monthsElapsed = isCurrentYear ? now.getMonth() + 1 : 12;
  const annualizationFactor = isCurrentYear && monthsElapsed < 12
    ? 12 / monthsElapsed
    : 1;
  const isAnnualized = annualizationFactor > 1;

  // Calculate totals (annualize current year if partial)
  const rawCurrentIncome = calculateTotalByType(
    currentYearTxns,
    TransactionType.INCOME
  );
  const currentIncome = rawCurrentIncome * annualizationFactor;
  const previousIncome = calculateTotalByType(
    previousYearTxns,
    TransactionType.INCOME
  );

  const rawCurrentExpenses = calculateTotalByType(
    currentYearTxns,
    TransactionType.EXPENSE
  );
  const currentExpenses = rawCurrentExpenses * annualizationFactor;
  const previousExpenses = calculateTotalByType(
    previousYearTxns,
    TransactionType.EXPENSE
  );

  const currentSavings = currentIncome - currentExpenses;
  const previousSavings = previousIncome - previousExpenses;

  // Calculate growth percentages
  const incomeGrowth =
    previousIncome > 0
      ? ((currentIncome - previousIncome) / previousIncome) * 100
      : 0;

  const expenseGrowth =
    previousExpenses > 0
      ? ((currentExpenses - previousExpenses) / previousExpenses) * 100
      : 0;

  const savingsGrowth =
    previousSavings !== 0
      ? ((currentSavings - previousSavings) / Math.abs(previousSavings)) * 100
      : 0;

  return {
    incomeGrowth,
    expenseGrowth,
    savingsGrowth,
    isAnnualized,
  };
}

/**
 * Result of separating one-time and recurring expenses
 */
export interface SeparatedExpenses {
  oneTime: Transaction[];
  recurring: Transaction[];
  oneTimeTotal: number;
  recurringTotal: number;
  totalExpenses: number;
}

/**
 * Separate one-time large expenses from recurring daily expenses
 * Flags transactions above a threshold as "one-time" so analytics can show
 * both total and "recurring daily" views.
 *
 * @param transactions - Array of transactions
 * @param threshold - Amount threshold for one-time classification (default: 50000)
 * @returns Separated expense categories
 */
export function separateOneTimeExpenses(
  transactions: Transaction[],
  threshold: number = 50000
): SeparatedExpenses {
  const expenses = transactions.filter(
    t => t.type === TransactionType.EXPENSE && isCompletedStatus(t.status)
  );

  const oneTime = expenses.filter(t => t.amount >= threshold);
  const recurring = expenses.filter(t => t.amount < threshold);

  return {
    oneTime,
    recurring,
    oneTimeTotal: sum(oneTime.map(t => t.amount)),
    recurringTotal: sum(recurring.map(t => t.amount)),
    totalExpenses: sum(expenses.map(t => t.amount)),
  };
}
