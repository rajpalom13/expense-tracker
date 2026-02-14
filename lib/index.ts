/**
 * Finance Tracker Library Index
 * Central export point for all utility functions and types
 */

// Export all types
export * from './types';

// Export utility functions
export * from './utils';

// Export data processing functions
export * from './data-processor';

// Export analytics functions
export * from './analytics';

// Export categorization functions
export * from './categorizer';

// Export sample data generators (for testing)
export * from './sample-data';

// Export constants (colors, icons, config)
export * from './constants';

// Re-export commonly used items for convenience
export {
  type Transaction,
  type Analytics,
  type TransactionFilter,
  type CategoryBreakdown,
  type MonthlyTrend,
  TransactionType,
  TransactionCategory,
  PaymentMethod,
  TransactionStatus,
} from './types';

export {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  formatMonthYear,
  parseDate,
  calculatePercentage,
  formatPercentage,
} from './utils';

export {
  processCSVData,
  parseCSV,
  transformTransaction,
  validateTransaction,
  cleanTransactions,
  deduplicateTransactions,
  sortTransactionsByDate,
  exportToCSV,
} from './data-processor';

export {
  calculateAnalytics,
  calculateMonthlyTrends,
  calculateDailyTrends,
  calculateCategoryBreakdown,
  calculatePaymentMethodBreakdown,
  getTopExpenseCategories,
  getTopMerchants,
  calculateIncomeVsExpense,
  separateOneTimeExpenses,
} from './analytics';

export {
  categorizeTransaction,
  bulkCategorize,
  getSuggestedCategories,
  merchantMatchesCategory,
} from './categorizer';
