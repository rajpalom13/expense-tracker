/**
 * Cron: Weekly AI spending analysis generation
 * GET /api/cron/analyze
 *
 * Generates AI analysis for all users with transaction data and
 * stores the results in MongoDB for later display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/middleware';
import { getMongoDb } from '@/lib/mongodb';
import { calculateAnalytics, separateOneTimeExpenses } from '@/lib/analytics';
import { calculateAccountSummary } from '@/lib/balance-utils';
import { chatCompletion, buildFinancialContext } from '@/lib/openrouter';
import type { Transaction, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus } from '@/lib/types';

const CRON_COLLECTION = 'cron_runs';

function toTransaction(doc: Record<string, unknown>): Transaction {
  return {
    id: (doc.txnId as string) || (doc._id as string) || '',
    date: new Date(doc.date as string),
    description: (doc.description as string) || '',
    merchant: (doc.merchant as string) || '',
    category: (doc.category as TransactionCategory) || ('Uncategorized' as TransactionCategory),
    amount: (doc.amount as number) || 0,
    type: (doc.type as TransactionType) || ('expense' as TransactionType),
    paymentMethod: (doc.paymentMethod as PaymentMethod) || ('Other' as PaymentMethod),
    account: (doc.account as string) || '',
    status: (doc.status as TransactionStatus) || ('completed' as TransactionStatus),
    tags: (doc.tags as string[]) || [],
    recurring: (doc.recurring as boolean) || false,
    balance: doc.balance as number | undefined,
  };
}

export async function GET(request: NextRequest) {
  return withCronAuth(async () => {
    const startedAt = new Date();
    let usersProcessed = 0;
    let usersFailed = 0;

    try {
      const db = await getMongoDb();

      // Get all distinct userIds from transactions
      const userIds = await db.collection('transactions').distinct('userId');

      for (const userId of userIds) {
        try {
          const docs = await db
            .collection('transactions')
            .find({ userId })
            .sort({ date: -1 })
            .limit(500)
            .toArray();

          if (docs.length === 0) continue;

          const transactions = docs.map((d) => toTransaction(d as Record<string, unknown>));
          const analytics = calculateAnalytics(transactions);
          const accountSummary = calculateAccountSummary(transactions);
          const separated = separateOneTimeExpenses(transactions);

          const context = buildFinancialContext({
            totalIncome: analytics.totalIncome,
            totalExpenses: analytics.totalExpenses,
            savingsRate: analytics.savingsRate,
            topCategories: analytics.categoryBreakdown.map((c) => ({
              category: c.category,
              amount: c.amount,
              percentage: c.percentage,
            })),
            monthlyTrends: analytics.monthlyTrends.map((m) => ({
              month: m.monthName,
              income: m.income,
              expenses: m.expenses,
              savings: m.savings,
            })),
            dailyAverage: analytics.dailyAverageSpend,
            recurringExpenses: analytics.recurringExpenses,
            oneTimeExpenses: separated.oneTime.map((t) => ({
              description: t.description || t.merchant,
              amount: t.amount,
            })),
            accountBalance: accountSummary.currentBalance,
            openingBalance: accountSummary.openingBalance,
          });

          const systemPrompt = `You are a personal finance advisor for an Indian user. Analyze their financial data and provide actionable insights.
Use INR (Rs.) for all amounts. Be concise and practical. Focus on:
1. Spending patterns and anomalies
2. Areas where they can save more
3. Budget allocation suggestions
4. Risk areas (overspending categories)
Format your response in clean markdown with sections.`;

          const analysis = await chatCompletion([
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Here is my financial data:\n\n${context}\n\nPlease analyze my spending patterns and provide insights.`,
            },
          ]);

          // Store analysis result
          await db.collection('ai_analyses').updateOne(
            { userId, type: 'weekly' },
            {
              $set: {
                userId,
                type: 'weekly',
                analysis,
                generatedAt: new Date().toISOString(),
                dataPoints: transactions.length,
              },
              $setOnInsert: { createdAt: new Date().toISOString() },
            },
            { upsert: true }
          );

          usersProcessed++;
        } catch {
          usersFailed++;
        }
      }

      const finishedAt = new Date();
      await db.collection(CRON_COLLECTION).insertOne({
        job: 'analyze',
        status: 'success',
        results: { usersProcessed, usersFailed },
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });

      return NextResponse.json({ success: true, usersProcessed, usersFailed });
    } catch (error) {
      const db = await getMongoDb();
      await db.collection(CRON_COLLECTION).insertOne({
        job: 'analyze',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      });
      return NextResponse.json(
        { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  })(request);
}
