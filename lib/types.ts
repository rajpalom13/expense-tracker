/**
 * Core TypeScript interfaces for Finance Tracker
 * Defines data structures for transactions, analytics, and categories
 */

/**
 * Represents a single financial transaction from Google Sheets
 * Maps to the 16-column structure of the source data
 */
export interface Transaction {
  id: string;
  date: Date;
  description: string;
  merchant: string;
  category: TransactionCategory;
  amount: number;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  account: string;
  status: TransactionStatus;
  tags: string[];
  notes?: string;
  location?: string;
  receiptUrl?: string;
  recurring: boolean;
  relatedTransactionId?: string;
  balance?: number;
}

/**
 * Raw transaction data as imported from CSV
 */
export interface RawTransaction {
  date: string;
  description: string;
  merchant: string;
  category?: string;
  amount: string;
  type: string;
  paymentMethod: string;
  account: string;
  status: string;
  tags?: string;
  notes?: string;
  location?: string;
  receiptUrl?: string;
  recurring?: string;
  relatedTransactionId?: string;
}

/**
 * Transaction types
 */
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
  INVESTMENT = 'investment',
  REFUND = 'refund',
}

/**
 * Transaction categories for automatic classification
 */
export enum TransactionCategory {
  // Income
  SALARY = 'Salary',
  FREELANCE = 'Freelance',
  BUSINESS = 'Business',
  INVESTMENT_INCOME = 'Investment Income',
  OTHER_INCOME = 'Other Income',

  // Essential Expenses
  RENT = 'Rent',
  UTILITIES = 'Utilities',
  GROCERIES = 'Groceries',
  HEALTHCARE = 'Healthcare',
  INSURANCE = 'Insurance',
  TRANSPORT = 'Transport',
  FUEL = 'Fuel',

  // Lifestyle
  DINING = 'Dining',
  ENTERTAINMENT = 'Entertainment',
  SHOPPING = 'Shopping',
  TRAVEL = 'Travel',
  EDUCATION = 'Education',
  FITNESS = 'Fitness',
  PERSONAL_CARE = 'Personal Care',

  // Financial
  SAVINGS = 'Savings',
  INVESTMENT = 'Investment',
  LOAN_PAYMENT = 'Loan Payment',
  CREDIT_CARD = 'Credit Card',
  TAX = 'Tax',

  // Other
  SUBSCRIPTION = 'Subscription',
  GIFTS = 'Gifts',
  CHARITY = 'Charity',
  MISCELLANEOUS = 'Miscellaneous',
  UNCATEGORIZED = 'Uncategorized',
}

/**
 * Payment methods
 */
export enum PaymentMethod {
  CASH = 'Cash',
  DEBIT_CARD = 'Debit Card',
  CREDIT_CARD = 'Credit Card',
  UPI = 'UPI',
  NEFT = 'NEFT',
  IMPS = 'IMPS',
  NET_BANKING = 'Net Banking',
  WALLET = 'Wallet',
  CHEQUE = 'Cheque',
  OTHER = 'Other',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Analytics data for dashboard visualizations
 */
export interface Analytics {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number; // Percentage
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlySavings: number;
  dailyAverageSpend: number;
  categoryBreakdown: CategoryBreakdown[];
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  monthlyTrends: MonthlyTrend[];
  topExpenseCategories: CategorySummary[];
  topMerchants: MerchantSummary[];
  recurringExpenses: number;
}

/**
 * Category breakdown for pie charts
 */
export interface CategoryBreakdown {
  category: TransactionCategory;
  amount: number;
  percentage: number;
  transactionCount: number;
  color?: string;
}

/**
 * Payment method breakdown
 */
export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  amount: number;
  percentage: number;
  transactionCount: number;
}

/**
 * Monthly trend data for time series charts
 */
export interface MonthlyTrend {
  month: string; // Format: "YYYY-MM"
  year: number;
  monthName: string; // Format: "January 2024"
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  transactionCount: number;
}

/**
 * Daily trend data
 */
export interface DailyTrend {
  date: string; // Format: "YYYY-MM-DD"
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

/**
 * Category summary for top categories
 */
export interface CategorySummary {
  category: TransactionCategory;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  percentageOfTotal: number;
}

/**
 * Merchant summary for top merchants
 */
export interface MerchantSummary {
  merchant: string;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  primaryCategory: TransactionCategory;
}

/**
 * Date range filter
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Filter options for transactions
 */
export interface TransactionFilter {
  dateRange?: DateRange;
  categories?: TransactionCategory[];
  types?: TransactionType[];
  paymentMethods?: PaymentMethod[];
  merchants?: string[];
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
  tags?: string[];
}

/**
 * Budget configuration
 */
export interface Budget {
  id: string;
  category: TransactionCategory;
  limit: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  spent: number;
  remaining: number;
  percentageUsed: number;
  status: 'on-track' | 'warning' | 'exceeded';
}

/**
 * Savings goal
 */
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  percentageComplete: number;
  monthlyContribution: number;
  onTrack: boolean;
}

/**
 * Financial summary for a specific period
 */
export interface FinancialSummary {
  period: string;
  income: {
    total: number;
    byCategory: CategoryBreakdown[];
  };
  expenses: {
    total: number;
    byCategory: CategoryBreakdown[];
  };
  savings: {
    total: number;
    rate: number;
  };
  transactions: {
    total: number;
    byType: Record<TransactionType, number>;
  };
}

/**
 * User authentication types
 */
export interface User {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Google Sheets sync response
 */
export interface SheetSyncResponse {
  success: boolean;
  message?: string;
  transactions?: Transaction[];
  lastSync?: string;
  count?: number;
}

/**
 * Transaction query parameters
 */
export interface TransactionQuery {
  category?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

/**
 * Weekly metrics interface
 */
export interface WeeklyMetrics {
  year: number;
  weekNumber: number;
  weekLabel: string;
  weekStartDate: Date;
  weekEndDate: Date;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  transactionCount: number;
  incomeTransactionCount: number;
  expenseTransactionCount: number;
  topCategory: {
    name: string;
    amount: number;
  };
  averageDailySpend: number;
  daysInWeek: number;
}

/**
 * Week identifier interface
 */
export interface WeekIdentifier {
  year: number;
  weekNumber: number;
  label: string;
}

/**
 * Investment Types
 */

export enum InvestmentType {
  SIP = 'SIP',
  STOCK = 'Stock',
  MUTUAL_FUND = 'Mutual Fund',
  NPS = 'NPS',
  PPF = 'PPF',
  FD = 'Fixed Deposit',
  BOND = 'Bond',
  GOLD = 'Gold',
  CRYPTO = 'Crypto',
  OTHER = 'Other',
}

export enum SIPProvider {
  GROWW = 'Groww',
  ZERODHA = 'Zerodha',
  PAYTM_MONEY = 'Paytm Money',
  UPSTOX = 'Upstox',
  ET_MONEY = 'ET Money',
  COIN = 'Coin',
  BANK = 'Bank',
  OTHER = 'Other',
}

export enum Exchange {
  NSE = 'NSE',
  BSE = 'BSE',
}

export interface SIP {
  id: string;
  userId: string;
  name: string;
  type: InvestmentType;
  provider: SIPProvider;
  monthlyAmount: number;
  startDate: Date;
  dayOfMonth: number;
  autoDebit: boolean;
  currentValue?: number;
  totalInvested: number;
  totalReturns?: number;
  returnsPercentage?: number;
  expectedAnnualReturn?: number; // Expected annual return percentage (e.g., 12 for 12%)
  status: 'active' | 'paused' | 'cancelled';
  lastInvestmentDate?: Date;
  nextInvestmentDate?: Date;
  folioNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stock {
  id: string;
  userId: string;
  symbol: string;
  exchange: Exchange;
  companyName: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  purchaseDate: Date;
  charges: number;
  totalInvested: number;
  currentValue?: number;
  totalReturns?: number;
  returnsPercentage?: number;
  expectedAnnualReturn?: number; // Expected annual return percentage (e.g., 15 for 15%)
  dayChange?: number;
  dayChangePercentage?: number;
  broker?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MutualFund {
  id: string;
  userId: string;
  fundName: string;
  fundCode: string;
  category: string;
  units: number;
  averageNAV: number;
  currentNAV?: number;
  purchaseDate: Date;
  totalInvested: number;
  currentValue?: number;
  totalReturns?: number;
  returnsPercentage?: number;
  sipLinked: boolean;
  sipId?: string;
  folioNumber?: string;
  broker?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  returnsPercentage: number;
  assetAllocation: {
    sips: number;
    stocks: number;
    mutualFunds: number;
  };
  bestPerformer: {
    name: string;
    type: InvestmentType;
    returns: number;
    returnsPercentage: number;
  };
  worstPerformer: {
    name: string;
    type: InvestmentType;
    returns: number;
    returnsPercentage: number;
  };
  dayChange: number;
  dayChangePercentage: number;
}

export interface InvestmentTransaction {
  id: string;
  investmentId: string;
  investmentType: InvestmentType;
  date: Date;
  type: 'buy' | 'sell' | 'sip' | 'dividend';
  quantity?: number;
  price: number;
  amount: number;
  charges: number;
  notes?: string;
}

export interface XIRRCalculation {
  cashFlows: {
    date: Date;
    amount: number;
  }[];
  currentValue: number;
  xirr: number;
}

export interface InvestmentProjection {
  years: number;
  investedAmount: number;
  expectedValue: number;
  expectedReturns: number;
  returnsPercentage: number;
}

export interface InvestmentProjectionData {
  currentValue: number;
  totalInvested: number;
  projections: {
    year3: InvestmentProjection;
    year4: InvestmentProjection;
    year5: InvestmentProjection;
  };
  chartData: {
    year: number;
    invested: number;
    projected: number;
  }[];
}

// ============================================================================
// Needs/Wants/Investments (NWI) Classification
// ============================================================================

export type NWIBucketType = 'needs' | 'wants' | 'investments';

export interface NWIConfig {
  userId: string;
  needs: { percentage: number; categories: TransactionCategory[] };
  wants: { percentage: number; categories: TransactionCategory[] };
  investments: { percentage: number; categories: TransactionCategory[] };
  updatedAt?: string;
}

export interface NWIBucket {
  label: string;
  targetPercentage: number;
  actualPercentage: number;
  targetAmount: number;
  actualAmount: number;
  difference: number;
  categoryBreakdown: CategoryBreakdown[];
}

export interface NWISplit {
  totalIncome: number;
  needs: NWIBucket;
  wants: NWIBucket;
  investments: NWIBucket;
}

// ============================================================================
// Financial Health Metrics
// ============================================================================

export interface FinancialHealthMetrics {
  emergencyFundMonths: number;
  emergencyFundTarget: number; // 6
  expenseVelocity: ExpenseVelocity;
  financialFreedomScore: number;
  scoreBreakdown: {
    savingsRate: number;
    emergencyFund: number;
    nwiAdherence: number;
    investmentRate: number;
  };
  netWorthTimeline: NetWorthPoint[];
  incomeProfile: IncomeProfile;
}

export interface ExpenseVelocity {
  currentMonthlyAvg: number;
  previousMonthlyAvg: number;
  changePercent: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface NetWorthPoint {
  month: string;
  bankBalance: number;
  investmentValue: number;
  totalNetWorth: number;
}

export interface IncomeProfile {
  avgMonthlyIncome: number;
  incomeStability: number; // 0-1 coefficient of variation inverse
  isVariable: boolean;
  lastIncomeDate: string | null;
}

// ============================================================================
// Growth Projections & FIRE Calculator
// ============================================================================

export interface FIRECalculation {
  fireNumber: number;
  annualExpenses: number;
  currentNetWorth: number;
  progressPercent: number;
  yearsToFIRE: number;
  monthlyRequired: number;
  projectionData: { year: number; netWorth: number; fireTarget: number }[];
}

export interface GrowthProjection {
  sipProjections: {
    name: string;
    current: number;
    projected3y: number;
    projected5y: number;
    projected10y: number;
  }[];
  emergencyFundProgress: {
    currentMonths: number;
    targetMonths: number;
    monthsToTarget: number;
  };
  netWorthProjection: { year: number; invested: number; projected: number }[];
  fire: FIRECalculation;
  portfolioProjection: {
    year: number;
    stocks: number;
    mutualFunds: number;
    sips: number;
    total: number;
  }[];
}

// ============================================================================
// Savings Goals
// ============================================================================

export interface SavingsGoalConfig {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // ISO date
  monthlyContribution: number;
  autoTrack: boolean;
  category?: string; // "Emergency Fund", "Car", "Vacation", etc.
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoalProgress extends SavingsGoalConfig {
  percentageComplete: number;
  onTrack: boolean;
  requiredMonthly: number;
  projectedCompletionDate: string | null;
  monthsRemaining: number;
}
