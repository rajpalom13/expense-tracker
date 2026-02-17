import { inngest } from '@/lib/inngest';
import { getMongoDb } from '@/lib/mongodb';
import {
  checkBudgetBreaches,
  checkSubscriptionRenewals,
  generateWeeklyDigest,
} from '@/lib/notifications';

/**
 * Daily budget breach check at 8 PM UTC.
 * Compares current-month spend against each budget category and creates
 * warning/critical notifications when thresholds are crossed.
 */
export const budgetBreachCheck = inngest.createFunction(
  { id: 'budget-breach-check', name: 'Daily Budget Breach Check' },
  { cron: '0 20 * * *' },
  async ({ step }) => {
    const result = await step.run('check-budgets', async () => {
      const db = await getMongoDb();
      await checkBudgetBreaches(db);
      return { checked: true };
    });
    return result;
  }
);

/**
 * Daily renewal alert at 9 AM UTC.
 * Checks subscriptions renewing within the next 3 days and creates
 * reminder notifications.
 */
export const renewalAlert = inngest.createFunction(
  { id: 'renewal-alert', name: 'Daily Subscription Renewal Alert' },
  { cron: '0 9 * * *' },
  async ({ step }) => {
    const result = await step.run('check-renewals', async () => {
      const db = await getMongoDb();
      await checkSubscriptionRenewals(db);
      return { checked: true };
    });
    return result;
  }
);

/**
 * Weekly digest every Sunday at 9 AM UTC.
 * Summarises: total spent this week, top categories, savings rate, portfolio change.
 */
export const weeklyDigest = inngest.createFunction(
  { id: 'weekly-digest', name: 'Weekly Financial Digest' },
  { cron: '0 9 * * 0' },
  async ({ step }) => {
    const result = await step.run('generate-digest', async () => {
      const db = await getMongoDb();
      await generateWeeklyDigest(db);
      return { generated: true };
    });
    return result;
  }
);
