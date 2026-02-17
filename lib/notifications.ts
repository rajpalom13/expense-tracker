/**
 * Notification generator functions
 *
 * These functions inspect MongoDB data and create notification documents
 * when thresholds are crossed.  They are invoked by Inngest cron workflows.
 */

import type { Db } from 'mongodb';
import {
  buildReverseCategoryMap,
  type BudgetCategoryDoc,
} from './budget-mapping';

// ─── Types ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'budget_breach'
  | 'goal_milestone'
  | 'weekly_digest'
  | 'renewal_alert'
  | 'insight';

export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface NotificationDoc {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: boolean;
  actionUrl?: string;
  /** Extra key used for deduplication (e.g. budget category name) */
  dedupKey?: string;
  createdAt: string;
}

const COLLECTION = 'notifications';

// ─── Helpers ─────────────────────────────────────────────────────────

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatINR(amount: number): string {
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toFixed(0);
}

async function isDuplicate(
  db: Db,
  userId: string,
  type: NotificationType,
  dedupKey: string,
  windowHours = 24
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const existing = await db.collection(COLLECTION).findOne({
    userId,
    type,
    dedupKey,
    createdAt: { $gte: cutoff },
  });
  return !!existing;
}

// ─── Budget Breach Check ─────────────────────────────────────────────

/**
 * Compare current-month spend against budget per category.
 * Creates a notification when spend exceeds 80% (warning) or 100% (critical).
 * Deduplicates: skips if the same type+category was notified in the last 24 h.
 */
export async function checkBudgetBreaches(db: Db): Promise<void> {
  const userId = 'default';

  // 1. Load budget categories from MongoDB
  const budgetDocs: BudgetCategoryDoc[] = (await db
    .collection('budget_categories')
    .find({ userId })
    .toArray()) as unknown as BudgetCategoryDoc[];

  if (budgetDocs.length === 0) return;

  // 2. Build reverse map: transaction category -> budget category name
  const reverseMap = buildReverseCategoryMap(budgetDocs);

  // 3. Get current month expense transactions
  const monthStart = startOfMonth();
  const transactions = await db
    .collection('transactions')
    .find({
      userId,
      date: { $gte: monthStart },
      type: 'expense',
    })
    .toArray();

  // 4. Aggregate spend per budget category
  const spendByBudget: Record<string, number> = {};
  for (const txn of transactions) {
    const raw = txn.category as string;
    const budgetName = reverseMap[raw] || raw;
    spendByBudget[budgetName] = (spendByBudget[budgetName] || 0) + Math.abs(txn.amount as number);
  }

  // 5. Compare against budgets and create notifications
  const now = new Date().toISOString();

  for (const doc of budgetDocs) {
    const budget = doc.budgetAmount;
    if (!budget || budget <= 0) continue;

    const spent = spendByBudget[doc.name] || 0;
    const ratio = spent / budget;

    if (ratio < 0.8) continue;

    const dedupKey = `budget:${doc.name}:${ratio >= 1 ? 'critical' : 'warning'}`;
    if (await isDuplicate(db, userId, 'budget_breach', dedupKey)) continue;

    const severity: NotificationSeverity = ratio >= 1 ? 'critical' : 'warning';
    const title =
      ratio >= 1
        ? `${doc.name} budget exceeded`
        : `${doc.name} budget nearing limit`;
    const message =
      ratio >= 1
        ? `You've spent \u20B9${formatINR(spent)} on ${doc.name} vs \u20B9${formatINR(budget)} budget (${Math.round(ratio * 100)}%)`
        : `You've used ${Math.round(ratio * 100)}% of your ${doc.name} budget (\u20B9${formatINR(spent)} / \u20B9${formatINR(budget)})`;

    await db.collection(COLLECTION).insertOne({
      userId,
      type: 'budget_breach',
      title,
      message,
      severity,
      read: false,
      actionUrl: '/budget',
      dedupKey,
      createdAt: now,
    } satisfies NotificationDoc);
  }
}

// ─── Subscription Renewal Alert ──────────────────────────────────────

/**
 * Check subscriptions renewing within the next 3 days
 * and create reminder notifications.
 */
export async function checkSubscriptionRenewals(db: Db): Promise<void> {
  const userId = 'default';

  const today = new Date().toISOString().split('T')[0];
  const threeDaysOut = daysFromNow(3);

  const subs = await db
    .collection('subscriptions')
    .find({
      userId,
      status: 'active',
      nextExpected: { $gte: today, $lte: threeDaysOut },
    })
    .toArray();

  const now = new Date().toISOString();

  for (const sub of subs) {
    const dedupKey = `renewal:${(sub._id).toString()}`;
    if (await isDuplicate(db, userId, 'renewal_alert', dedupKey)) continue;

    const name = sub.name as string;
    const amount = sub.amount as number;
    const next = sub.nextExpected as string;

    const daysUntil = Math.ceil(
      (new Date(next).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const dayLabel = daysUntil <= 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

    await db.collection(COLLECTION).insertOne({
      userId,
      type: 'renewal_alert',
      title: `${name} renewing ${dayLabel}`,
      message: `Your ${name} subscription (\u20B9${formatINR(amount)}/${sub.frequency}) renews ${dayLabel}`,
      severity: 'info',
      read: false,
      actionUrl: '/subscriptions',
      dedupKey,
      createdAt: now,
    } satisfies NotificationDoc);
  }
}

// ─── Weekly Digest ───────────────────────────────────────────────────

/**
 * Summarises the past week: total spend, top categories, savings rate,
 * and portfolio change. Creates one digest notification.
 */
export async function generateWeeklyDigest(db: Db): Promise<void> {
  const userId = 'default';

  // Deduplicate: only one digest per 6 days
  if (await isDuplicate(db, userId, 'weekly_digest', 'weekly', 144)) return;

  const weekStart = startOfWeek();
  const now = new Date().toISOString();

  // -- Weekly transactions --
  const transactions = await db
    .collection('transactions')
    .find({ userId, date: { $gte: weekStart } })
    .toArray();

  let totalSpent = 0;
  let totalIncome = 0;
  const categorySpend: Record<string, number> = {};

  for (const txn of transactions) {
    const amount = Math.abs(txn.amount as number);
    if (txn.type === 'expense') {
      totalSpent += amount;
      const cat = (txn.category as string) || 'Uncategorized';
      categorySpend[cat] = (categorySpend[cat] || 0) + amount;
    } else if (txn.type === 'income') {
      totalIncome += amount;
    }
  }

  // Top 3 categories
  const topCategories = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => `${name} (\u20B9${formatINR(amount)})`)
    .join(', ');

  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100)
      : 0;

  // -- Portfolio snapshot --
  const [stocks, funds] = await Promise.all([
    db.collection('stocks').find({ userId }).toArray(),
    db.collection('mutual_funds').find({ userId }).toArray(),
  ]);

  let portfolioValue = 0;
  let portfolioInvested = 0;

  for (const s of stocks) {
    portfolioValue += (s.currentValue as number) || 0;
    portfolioInvested += ((s.shares as number) || 0) * ((s.averageCost as number) || 0);
  }
  for (const f of funds) {
    portfolioValue += (f.currentValue as number) || 0;
    portfolioInvested += (f.investedValue as number) || 0;
  }

  const portfolioChange = portfolioInvested > 0
    ? ((portfolioValue - portfolioInvested) / portfolioInvested) * 100
    : 0;

  // -- Build message --
  const lines: string[] = [];
  lines.push(`Total spent this week: \u20B9${formatINR(totalSpent)}`);
  if (topCategories) lines.push(`Top categories: ${topCategories}`);
  if (totalIncome > 0) lines.push(`Savings rate: ${savingsRate}%`);
  if (portfolioValue > 0) {
    const sign = portfolioChange >= 0 ? '+' : '';
    lines.push(`Portfolio: \u20B9${formatINR(portfolioValue)} (${sign}${portfolioChange.toFixed(1)}%)`);
  }

  await db.collection(COLLECTION).insertOne({
    userId,
    type: 'weekly_digest',
    title: 'Your weekly financial digest',
    message: lines.join(' \u2022 '),
    severity: 'info',
    read: false,
    actionUrl: '/dashboard',
    dedupKey: 'weekly',
    createdAt: now,
  } satisfies NotificationDoc);
}
