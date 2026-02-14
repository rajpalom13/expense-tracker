import {
  TransactionCategory,
  TransactionType,
  Transaction,
  NWIConfig,
  NWIBucket,
  NWISplit,
  NWIBucketType,
  CategoryBreakdown,
} from './types';
import { isCompletedStatus, sum, calculatePercentage } from './utils';

const DEFAULT_NEEDS_CATEGORIES: TransactionCategory[] = [
  TransactionCategory.RENT,
  TransactionCategory.UTILITIES,
  TransactionCategory.GROCERIES,
  TransactionCategory.HEALTHCARE,
  TransactionCategory.INSURANCE,
  TransactionCategory.TRANSPORT,
  TransactionCategory.FUEL,
  TransactionCategory.EDUCATION,
];

const DEFAULT_WANTS_CATEGORIES: TransactionCategory[] = [
  TransactionCategory.DINING,
  TransactionCategory.ENTERTAINMENT,
  TransactionCategory.SHOPPING,
  TransactionCategory.TRAVEL,
  TransactionCategory.FITNESS,
  TransactionCategory.PERSONAL_CARE,
  TransactionCategory.SUBSCRIPTION,
  TransactionCategory.GIFTS,
];

const DEFAULT_INVESTMENTS_CATEGORIES: TransactionCategory[] = [
  TransactionCategory.SAVINGS,
  TransactionCategory.INVESTMENT,
  TransactionCategory.LOAN_PAYMENT,
  TransactionCategory.TAX,
];

export function getDefaultNWIConfig(userId: string): NWIConfig {
  return {
    userId,
    needs: { percentage: 50, categories: [...DEFAULT_NEEDS_CATEGORIES] },
    wants: { percentage: 30, categories: [...DEFAULT_WANTS_CATEGORIES] },
    investments: { percentage: 20, categories: [...DEFAULT_INVESTMENTS_CATEGORIES] },
    updatedAt: new Date().toISOString(),
  };
}

export function classifyTransaction(
  transaction: Transaction,
  config: NWIConfig
): NWIBucketType {
  const override = (transaction as any).nwiOverride as NWIBucketType | undefined;
  if (override) return override;

  if (
    transaction.type !== TransactionType.EXPENSE &&
    transaction.type !== TransactionType.INVESTMENT
  ) {
    return 'wants';
  }

  const { category } = transaction;

  if (config.needs.categories.includes(category)) return 'needs';
  if (config.investments.categories.includes(category)) return 'investments';
  if (config.wants.categories.includes(category)) return 'wants';

  return 'wants';
}

function buildBucket(
  label: string,
  targetPercentage: number,
  totalIncome: number,
  transactions: Transaction[],
  config: NWIConfig,
  bucketType: NWIBucketType
): NWIBucket {
  const bucketTransactions = transactions.filter(
    (t) => classifyTransaction(t, config) === bucketType
  );

  const actualAmount = sum(bucketTransactions.map((t) => t.amount));
  const actualPercentage = calculatePercentage(actualAmount, totalIncome);
  const targetAmount = totalIncome * (targetPercentage / 100);
  const difference = targetAmount - actualAmount;

  const categoryMap = new Map<
    TransactionCategory,
    { amount: number; count: number }
  >();

  for (const t of bucketTransactions) {
    const existing = categoryMap.get(t.category);
    if (existing) {
      existing.amount += t.amount;
      existing.count += 1;
    } else {
      categoryMap.set(t.category, { amount: t.amount, count: 1 });
    }
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(
    categoryMap.entries()
  ).map(([category, { amount, count }]) => ({
    category,
    amount,
    percentage: calculatePercentage(amount, actualAmount),
    transactionCount: count,
  }));

  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  return {
    label,
    targetPercentage,
    actualPercentage,
    targetAmount,
    actualAmount,
    difference,
    categoryBreakdown,
  };
}

export function calculateNWISplit(
  transactions: Transaction[],
  config: NWIConfig
): NWISplit {
  const completedExpenseInvestment = transactions.filter(
    (t) =>
      isCompletedStatus(t.status) &&
      (t.type === TransactionType.EXPENSE || t.type === TransactionType.INVESTMENT)
  );

  const totalIncome = sum(
    transactions
      .filter((t) => isCompletedStatus(t.status) && t.type === TransactionType.INCOME)
      .map((t) => t.amount)
  );

  return {
    totalIncome,
    needs: buildBucket('Needs', config.needs.percentage, totalIncome, completedExpenseInvestment, config, 'needs'),
    wants: buildBucket('Wants', config.wants.percentage, totalIncome, completedExpenseInvestment, config, 'wants'),
    investments: buildBucket('Investments', config.investments.percentage, totalIncome, completedExpenseInvestment, config, 'investments'),
  };
}
