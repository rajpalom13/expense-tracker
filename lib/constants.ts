/**
 * Constants for Finance Tracker
 * Includes colors, icons, and configuration values
 */

import { TransactionCategory, PaymentMethod, TransactionType } from './types';

/**
 * Category colors for charts and visualizations
 * Tailwind-compatible color values
 */
export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  // Income categories - Green shades
  [TransactionCategory.SALARY]: '#10b981',
  [TransactionCategory.FREELANCE]: '#34d399',
  [TransactionCategory.BUSINESS]: '#6ee7b7',
  [TransactionCategory.INVESTMENT_INCOME]: '#a7f3d0',
  [TransactionCategory.OTHER_INCOME]: '#d1fae5',

  // Essential expenses - Blue shades
  [TransactionCategory.RENT]: '#3b82f6',
  [TransactionCategory.UTILITIES]: '#60a5fa',
  [TransactionCategory.GROCERIES]: '#93c5fd',
  [TransactionCategory.HEALTHCARE]: '#bfdbfe',
  [TransactionCategory.INSURANCE]: '#dbeafe',
  [TransactionCategory.TRANSPORT]: '#2563eb',
  [TransactionCategory.FUEL]: '#1d4ed8',

  // Lifestyle - Purple/Pink shades
  [TransactionCategory.DINING]: '#a855f7',
  [TransactionCategory.ENTERTAINMENT]: '#c084fc',
  [TransactionCategory.SHOPPING]: '#e879f9',
  [TransactionCategory.TRAVEL]: '#f0abfc',
  [TransactionCategory.EDUCATION]: '#f5d0fe',
  [TransactionCategory.FITNESS]: '#9333ea',
  [TransactionCategory.PERSONAL_CARE]: '#d946ef',

  // Financial - Orange shades
  [TransactionCategory.SAVINGS]: '#f59e0b',
  [TransactionCategory.INVESTMENT]: '#fb923c',
  [TransactionCategory.LOAN_PAYMENT]: '#fdba74',
  [TransactionCategory.CREDIT_CARD]: '#fed7aa',
  [TransactionCategory.TAX]: '#ffedd5',

  // Other - Gray shades
  [TransactionCategory.SUBSCRIPTION]: '#6b7280',
  [TransactionCategory.GIFTS]: '#9ca3af',
  [TransactionCategory.CHARITY]: '#d1d5db',
  [TransactionCategory.MISCELLANEOUS]: '#e5e7eb',
  [TransactionCategory.UNCATEGORIZED]: '#f3f4f6',
};

/**
 * Payment method colors
 */
export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: '#22c55e',
  [PaymentMethod.DEBIT_CARD]: '#3b82f6',
  [PaymentMethod.CREDIT_CARD]: '#ef4444',
  [PaymentMethod.UPI]: '#8b5cf6',
  [PaymentMethod.NEFT]: '#06b6d4',
  [PaymentMethod.IMPS]: '#14b8a6',
  [PaymentMethod.NET_BANKING]: '#f59e0b',
  [PaymentMethod.WALLET]: '#ec4899',
  [PaymentMethod.CHEQUE]: '#6b7280',
  [PaymentMethod.OTHER]: '#94a3b8',
};

/**
 * Transaction type colors
 */
export const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  [TransactionType.INCOME]: '#10b981',
  [TransactionType.EXPENSE]: '#ef4444',
  [TransactionType.TRANSFER]: '#3b82f6',
  [TransactionType.INVESTMENT]: '#f59e0b',
  [TransactionType.REFUND]: '#8b5cf6',
};

/**
 * Category icons (Lucide icon names)
 */
export const CATEGORY_ICONS: Record<TransactionCategory, string> = {
  // Income
  [TransactionCategory.SALARY]: 'Briefcase',
  [TransactionCategory.FREELANCE]: 'Laptop',
  [TransactionCategory.BUSINESS]: 'Building2',
  [TransactionCategory.INVESTMENT_INCOME]: 'TrendingUp',
  [TransactionCategory.OTHER_INCOME]: 'Coins',

  // Essential
  [TransactionCategory.RENT]: 'Home',
  [TransactionCategory.UTILITIES]: 'Zap',
  [TransactionCategory.GROCERIES]: 'ShoppingCart',
  [TransactionCategory.HEALTHCARE]: 'Heart',
  [TransactionCategory.INSURANCE]: 'Shield',
  [TransactionCategory.TRANSPORT]: 'Car',
  [TransactionCategory.FUEL]: 'Fuel',

  // Lifestyle
  [TransactionCategory.DINING]: 'UtensilsCrossed',
  [TransactionCategory.ENTERTAINMENT]: 'Film',
  [TransactionCategory.SHOPPING]: 'ShoppingBag',
  [TransactionCategory.TRAVEL]: 'Plane',
  [TransactionCategory.EDUCATION]: 'GraduationCap',
  [TransactionCategory.FITNESS]: 'Dumbbell',
  [TransactionCategory.PERSONAL_CARE]: 'Sparkles',

  // Financial
  [TransactionCategory.SAVINGS]: 'PiggyBank',
  [TransactionCategory.INVESTMENT]: 'LineChart',
  [TransactionCategory.LOAN_PAYMENT]: 'CreditCard',
  [TransactionCategory.CREDIT_CARD]: 'CreditCard',
  [TransactionCategory.TAX]: 'FileText',

  // Other
  [TransactionCategory.SUBSCRIPTION]: 'Repeat',
  [TransactionCategory.GIFTS]: 'Gift',
  [TransactionCategory.CHARITY]: 'HandHeart',
  [TransactionCategory.MISCELLANEOUS]: 'MoreHorizontal',
  [TransactionCategory.UNCATEGORIZED]: 'HelpCircle',
};

/**
 * Payment method icons
 */
export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Banknote',
  [PaymentMethod.DEBIT_CARD]: 'CreditCard',
  [PaymentMethod.CREDIT_CARD]: 'CreditCard',
  [PaymentMethod.UPI]: 'Smartphone',
  [PaymentMethod.NEFT]: 'ArrowRightLeft',
  [PaymentMethod.IMPS]: 'Zap',
  [PaymentMethod.NET_BANKING]: 'Globe',
  [PaymentMethod.WALLET]: 'Wallet',
  [PaymentMethod.CHEQUE]: 'FileText',
  [PaymentMethod.OTHER]: 'MoreHorizontal',
};

/**
 * Transaction type icons
 */
export const TRANSACTION_TYPE_ICONS: Record<TransactionType, string> = {
  [TransactionType.INCOME]: 'ArrowDownCircle',
  [TransactionType.EXPENSE]: 'ArrowUpCircle',
  [TransactionType.TRANSFER]: 'ArrowLeftRight',
  [TransactionType.INVESTMENT]: 'TrendingUp',
  [TransactionType.REFUND]: 'RotateCcw',
};

/**
 * Category display names (user-friendly)
 */
export const CATEGORY_DISPLAY_NAMES: Record<TransactionCategory, string> = {
  [TransactionCategory.SALARY]: 'Salary & Wages',
  [TransactionCategory.FREELANCE]: 'Freelance Work',
  [TransactionCategory.BUSINESS]: 'Business Income',
  [TransactionCategory.INVESTMENT_INCOME]: 'Investment Returns',
  [TransactionCategory.OTHER_INCOME]: 'Other Income',

  [TransactionCategory.RENT]: 'Rent & Housing',
  [TransactionCategory.UTILITIES]: 'Utilities & Bills',
  [TransactionCategory.GROCERIES]: 'Groceries & Food',
  [TransactionCategory.HEALTHCARE]: 'Healthcare & Medical',
  [TransactionCategory.INSURANCE]: 'Insurance',
  [TransactionCategory.TRANSPORT]: 'Transportation',
  [TransactionCategory.FUEL]: 'Fuel & Gas',

  [TransactionCategory.DINING]: 'Dining & Restaurants',
  [TransactionCategory.ENTERTAINMENT]: 'Entertainment',
  [TransactionCategory.SHOPPING]: 'Shopping & Retail',
  [TransactionCategory.TRAVEL]: 'Travel & Vacation',
  [TransactionCategory.EDUCATION]: 'Education & Learning',
  [TransactionCategory.FITNESS]: 'Fitness & Sports',
  [TransactionCategory.PERSONAL_CARE]: 'Personal Care',

  [TransactionCategory.SAVINGS]: 'Savings',
  [TransactionCategory.INVESTMENT]: 'Investments',
  [TransactionCategory.LOAN_PAYMENT]: 'Loan Payments',
  [TransactionCategory.CREDIT_CARD]: 'Credit Card Bills',
  [TransactionCategory.TAX]: 'Taxes',

  [TransactionCategory.SUBSCRIPTION]: 'Subscriptions',
  [TransactionCategory.GIFTS]: 'Gifts & Donations',
  [TransactionCategory.CHARITY]: 'Charity',
  [TransactionCategory.MISCELLANEOUS]: 'Miscellaneous',
  [TransactionCategory.UNCATEGORIZED]: 'Uncategorized',
};

/**
 * Category groups for organization
 */
export const CATEGORY_GROUPS = {
  income: [
    TransactionCategory.SALARY,
    TransactionCategory.FREELANCE,
    TransactionCategory.BUSINESS,
    TransactionCategory.INVESTMENT_INCOME,
    TransactionCategory.OTHER_INCOME,
  ],
  essential: [
    TransactionCategory.RENT,
    TransactionCategory.UTILITIES,
    TransactionCategory.GROCERIES,
    TransactionCategory.HEALTHCARE,
    TransactionCategory.INSURANCE,
    TransactionCategory.TRANSPORT,
    TransactionCategory.FUEL,
  ],
  lifestyle: [
    TransactionCategory.DINING,
    TransactionCategory.ENTERTAINMENT,
    TransactionCategory.SHOPPING,
    TransactionCategory.TRAVEL,
    TransactionCategory.EDUCATION,
    TransactionCategory.FITNESS,
    TransactionCategory.PERSONAL_CARE,
  ],
  financial: [
    TransactionCategory.SAVINGS,
    TransactionCategory.INVESTMENT,
    TransactionCategory.LOAN_PAYMENT,
    TransactionCategory.CREDIT_CARD,
    TransactionCategory.TAX,
  ],
  other: [
    TransactionCategory.SUBSCRIPTION,
    TransactionCategory.GIFTS,
    TransactionCategory.CHARITY,
    TransactionCategory.MISCELLANEOUS,
    TransactionCategory.UNCATEGORIZED,
  ],
};

/**
 * Default currency symbol
 */
export const CURRENCY_SYMBOL = '₹';

/**
 * Currency code
 */
export const CURRENCY_CODE = 'INR';

/**
 * Locale for formatting
 */
export const LOCALE = 'en-IN';

/**
 * Date format presets
 */
export const DATE_FORMATS = {
  SHORT: 'DD/MM/YYYY',
  MEDIUM: 'DD MMM YYYY',
  LONG: 'DD MMMM YYYY',
  ISO: 'YYYY-MM-DD',
  MONTH_YEAR: 'MMMM YYYY',
} as const;

/**
 * Chart color palette
 */
export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
];

/**
 * Budget status thresholds
 */
export const BUDGET_THRESHOLDS = {
  ON_TRACK: 0.7,    // <= 70% of budget used
  WARNING: 0.9,     // 70-90% of budget used
  EXCEEDED: 1.0,    // >= 100% of budget used
} as const;

/**
 * Analytics period options
 */
export const PERIOD_OPTIONS = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 90 Days', value: 90 },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'All Time', value: 'all' },
] as const;

/**
 * Default number of items to show
 */
export const DEFAULT_LIMITS = {
  TOP_CATEGORIES: 5,
  TOP_MERCHANTS: 10,
  RECENT_TRANSACTIONS: 20,
  CHART_DATA_POINTS: 12,
} as const;

/**
 * CSV column headers
 */
export const CSV_HEADERS = [
  'date',
  'description',
  'merchant',
  'category',
  'amount',
  'type',
  'paymentMethod',
  'account',
  'status',
  'tags',
  'notes',
  'location',
  'receiptUrl',
  'recurring',
  'relatedTransactionId',
] as const;

/**
 * Helper function to get category color
 */
export function getCategoryColor(category: TransactionCategory): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS[TransactionCategory.UNCATEGORIZED];
}

/**
 * Helper function to get category icon
 */
export function getCategoryIcon(category: TransactionCategory): string {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS[TransactionCategory.UNCATEGORIZED];
}

/**
 * Helper function to get category display name
 */
export function getCategoryDisplayName(category: TransactionCategory): string {
  return CATEGORY_DISPLAY_NAMES[category] || category;
}

/**
 * Helper function to get payment method color
 */
export function getPaymentMethodColor(method: PaymentMethod): string {
  return PAYMENT_METHOD_COLORS[method] || PAYMENT_METHOD_COLORS[PaymentMethod.OTHER];
}

/**
 * Helper function to get payment method icon
 */
export function getPaymentMethodIcon(method: PaymentMethod): string {
  return PAYMENT_METHOD_ICONS[method] || PAYMENT_METHOD_ICONS[PaymentMethod.OTHER];
}

/**
 * Helper function to get transaction type color
 */
export function getTransactionTypeColor(type: TransactionType): string {
  return TRANSACTION_TYPE_COLORS[type];
}

/**
 * Helper function to get transaction type icon
 */
export function getTransactionTypeIcon(type: TransactionType): string {
  return TRANSACTION_TYPE_ICONS[type];
}
