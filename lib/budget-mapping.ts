/**
 * Budget category mapping configuration
 * Maps budget display categories to actual transaction categories
 *
 * DEFAULT_BUDGETS and BUDGET_CATEGORY_MAPPING serve as seed data.
 * At runtime the user's custom categories are fetched from MongoDB
 * (collection: budget_categories) and merged on top.
 */

import { TransactionCategory } from './types';

/**
 * Budget category definition (shared between seed data and MongoDB docs)
 */
export interface BudgetCategoryConfig {
  displayName: string;
  transactionCategories: TransactionCategory[];
  description: string;
}

/**
 * MongoDB document shape for a single budget category
 */
export interface BudgetCategoryDoc {
  _id?: string;
  userId: string;
  name: string;
  transactionCategories: string[];
  description: string;
  budgetAmount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Default budget category mapping (seed data only)
 * Maps friendly budget names to transaction categories
 */
export const BUDGET_CATEGORY_MAPPING: Record<string, BudgetCategoryConfig> = {
  'Food & Dining': {
    displayName: 'Food & Dining',
    transactionCategories: [
      TransactionCategory.DINING,
      TransactionCategory.GROCERIES,
    ],
    description: 'Dining out, restaurants, groceries, and food delivery',
  },
  'Transport': {
    displayName: 'Transport',
    transactionCategories: [
      TransactionCategory.TRANSPORT,
      TransactionCategory.FUEL,
    ],
    description: 'Transportation, fuel, taxi, auto, and commute expenses',
  },
  'Shopping': {
    displayName: 'Shopping',
    transactionCategories: [TransactionCategory.SHOPPING],
    description: 'Shopping, online purchases, and retail',
  },
  'Bills & Utilities': {
    displayName: 'Bills & Utilities',
    transactionCategories: [
      TransactionCategory.UTILITIES,
      TransactionCategory.RENT,
    ],
    description: 'Utilities, rent, electricity, water, and internet bills',
  },
  'Entertainment': {
    displayName: 'Entertainment',
    transactionCategories: [
      TransactionCategory.ENTERTAINMENT,
      TransactionCategory.SUBSCRIPTION,
    ],
    description: 'Entertainment, subscriptions, movies, and streaming services',
  },
  'Healthcare': {
    displayName: 'Healthcare',
    transactionCategories: [
      TransactionCategory.HEALTHCARE,
      TransactionCategory.INSURANCE,
    ],
    description: 'Healthcare, medical expenses, and insurance',
  },
  'Education': {
    displayName: 'Education',
    transactionCategories: [TransactionCategory.EDUCATION],
    description: 'Education, courses, books, and learning materials',
  },
  'Fitness': {
    displayName: 'Fitness',
    transactionCategories: [
      TransactionCategory.FITNESS,
      TransactionCategory.PERSONAL_CARE,
    ],
    description: 'Fitness, gym, sports, and personal care',
  },
  'Travel': {
    displayName: 'Travel',
    transactionCategories: [TransactionCategory.TRAVEL],
    description: 'Travel, vacation, and trip expenses',
  },
  'Others': {
    displayName: 'Others',
    transactionCategories: [
      TransactionCategory.MISCELLANEOUS,
      TransactionCategory.UNCATEGORIZED,
      TransactionCategory.GIFTS,
      TransactionCategory.CHARITY,
    ],
    description: 'Other miscellaneous expenses',
  },
};

/**
 * Get all budget category names (from default seed)
 */
export function getBudgetCategories(): string[] {
  return Object.keys(BUDGET_CATEGORY_MAPPING);
}

/**
 * Get transaction categories for a budget category.
 * Accepts an optional dynamic mapping to check first (from user's DB config).
 */
export function getTransactionCategoriesForBudget(
  budgetCategory: string,
  dynamicMapping?: Record<string, BudgetCategoryConfig>
): TransactionCategory[] {
  const mapping = dynamicMapping || BUDGET_CATEGORY_MAPPING;
  const config = mapping[budgetCategory];
  return config ? config.transactionCategories : [];
}

/**
 * Get budget category for a transaction category
 */
export function getBudgetCategoryForTransaction(
  transactionCategory: TransactionCategory,
  dynamicMapping?: Record<string, BudgetCategoryConfig>
): string | null {
  const mapping = dynamicMapping || BUDGET_CATEGORY_MAPPING;
  for (const [budgetCategory, config] of Object.entries(mapping)) {
    if (config.transactionCategories.includes(transactionCategory)) {
      return budgetCategory;
    }
  }
  return null;
}

/**
 * Default budget amounts (in INR) - seed data only
 */
export const DEFAULT_BUDGETS: Record<string, number> = {
  'Food & Dining': 15000,
  'Transport': 5000,
  'Shopping': 10000,
  'Bills & Utilities': 8000,
  'Entertainment': 5000,
  'Healthcare': 3000,
  'Education': 5000,
  'Fitness': 3000,
  'Travel': 10000,
  'Others': 5000,
};

/**
 * Convert BudgetCategoryDoc[] from MongoDB into the runtime formats
 * used by the budget page (a budgets record and a category mapping).
 */
export function docsToRuntime(docs: BudgetCategoryDoc[]): {
  budgets: Record<string, number>;
  mapping: Record<string, BudgetCategoryConfig>;
} {
  const budgets: Record<string, number> = {};
  const mapping: Record<string, BudgetCategoryConfig> = {};

  for (const doc of docs) {
    budgets[doc.name] = doc.budgetAmount;
    mapping[doc.name] = {
      displayName: doc.name,
      transactionCategories: doc.transactionCategories as TransactionCategory[],
      description: doc.description,
    };
  }

  return { budgets, mapping };
}

/**
 * Build seed documents from the hardcoded defaults.
 * Used when a user has no categories in MongoDB yet.
 */
export function buildSeedDocs(userId: string): Omit<BudgetCategoryDoc, '_id'>[] {
  const now = new Date().toISOString();
  return Object.entries(BUDGET_CATEGORY_MAPPING).map(([name, config]) => ({
    userId,
    name,
    transactionCategories: config.transactionCategories as string[],
    description: config.description,
    budgetAmount: DEFAULT_BUDGETS[name] ?? 0,
    createdAt: now,
    updatedAt: now,
  }));
}
