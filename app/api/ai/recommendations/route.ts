import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, handleOptions, withAuth } from '@/lib/middleware';
import { getMongoDb } from '@/lib/mongodb';
import { calculateAnalytics, separateOneTimeExpenses } from '@/lib/analytics';
import { calculateMonthlyMetrics, getCurrentMonth } from '@/lib/monthly-utils';
import { calculateAccountSummary } from '@/lib/balance-utils';
import { chatCompletion, buildFinancialContext } from '@/lib/openrouter';
import type { Transaction } from '@/lib/types';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * POST /api/ai/recommendations
 * Gets weekly/monthly budget recommendations from AI
 */
export async function POST(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const db = await getMongoDb();
      const docs = await db
        .collection('transactions')
        .find({ userId: user.userId })
        .sort({ date: -1 })
        .toArray();

      if (docs.length === 0) {
        return NextResponse.json(
          { success: false, message: 'No transaction data available. Please sync first.' },
          { status: 404, headers: corsHeaders() }
        );
      }

      const body = await req.json().catch(() => ({}));
      const period = body.period || 'monthly';

      // Map MongoDB docs to Transaction objects
      const transactions: Transaction[] = docs.map((doc) => ({
        id: doc.txnId || doc._id.toString(),
        date: new Date(doc.date as string),
        description: doc.description as string,
        merchant: doc.merchant as string,
        category: doc.category as Transaction['category'],
        amount: doc.amount as number,
        type: doc.type as Transaction['type'],
        paymentMethod: doc.paymentMethod as Transaction['paymentMethod'],
        account: doc.account as string,
        status: doc.status as Transaction['status'],
        tags: (doc.tags as string[]) || [],
        recurring: (doc.recurring as boolean) || false,
        balance: doc.balance as number,
      }));

      const analytics = calculateAnalytics(transactions);
      const accountSummary = calculateAccountSummary(transactions);
      const separated = separateOneTimeExpenses(transactions);
      const { year, month } = getCurrentMonth();
      const currentMetrics = calculateMonthlyMetrics(transactions, year, month);

      const context = buildFinancialContext({
        totalIncome: analytics.totalIncome,
        totalExpenses: analytics.totalExpenses,
        savingsRate: analytics.savingsRate,
        topCategories: analytics.categoryBreakdown.map(c => ({
          category: c.category,
          amount: c.amount,
          percentage: c.percentage,
        })),
        monthlyTrends: analytics.monthlyTrends.map(m => ({
          month: m.monthName,
          income: m.income,
          expenses: m.expenses,
          savings: m.savings,
        })),
        dailyAverage: analytics.dailyAverageSpend,
        recurringExpenses: analytics.recurringExpenses,
        oneTimeExpenses: separated.oneTime.map(t => ({
          description: t.description || t.merchant,
          amount: t.amount,
        })),
        accountBalance: accountSummary.currentBalance,
        openingBalance: accountSummary.openingBalance,
      });

      const currentMonthContext = `
## Current Month (${currentMetrics.monthLabel})
- Opening Balance: Rs.${currentMetrics.openingBalance.toLocaleString('en-IN')}
- Income so far: Rs.${currentMetrics.totalIncome.toLocaleString('en-IN')}
- Expenses so far: Rs.${currentMetrics.totalExpenses.toLocaleString('en-IN')}
- Days elapsed: ${currentMetrics.daysInPeriod}
- Partial month: ${currentMetrics.isPartialMonth ? 'Yes' : 'No'}`;

      // Fetch NWI config for split context
      const nwiConfigDoc = await db.collection('nwi_config').findOne({ userId: user.userId });
      let nwiContext = '';
      if (nwiConfigDoc) {
        nwiContext = `\n\nNeeds/Wants/Investments Split Configuration:
- Needs (${nwiConfigDoc.needs.percentage}%): ${nwiConfigDoc.needs.categories.join(', ')}
- Wants (${nwiConfigDoc.wants.percentage}%): ${nwiConfigDoc.wants.categories.join(', ')}
- Investments (${nwiConfigDoc.investments.percentage}%): ${nwiConfigDoc.investments.categories.join(', ')}`;
      }

      // Financial health summary
      let healthContext = '';
      try {
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0';
        healthContext = `\n\nFinancial Health Summary:
- Savings Rate: ${savingsRate}%
- Total Income: Rs.${totalIncome.toLocaleString('en-IN')}
- Total Expenses: Rs.${totalExpenses.toLocaleString('en-IN')}`;
      } catch { /* ignore health calc errors */ }

      // Fetch savings goals
      const goalsDocs = await db.collection('savings_goals').find({ userId: user.userId }).toArray();
      let goalsContext = '';
      if (goalsDocs.length > 0) {
        const goalsList = goalsDocs.map(g =>
          `  - ${g.name}: Rs.${g.currentAmount?.toLocaleString('en-IN') || 0} / Rs.${g.targetAmount?.toLocaleString('en-IN')} (target: ${g.targetDate})`
        ).join('\n');
        goalsContext = `\n\nSavings Goals:\n${goalsList}`;
      }

      const systemPrompt = `You are a personal finance advisor for an Indian user. Based on their financial history and current month data, provide ${period} budget recommendations.
Use INR (Rs.) for all amounts. Be specific with numbers. Format as markdown.

Provide:
1. Recommended budget per category for the next ${period === 'weekly' ? 'week' : 'month'} (aligned with their Needs/Wants/Investments split if configured)
2. Top 3 actionable savings tips based on their actual spending
3. A target savings amount (consider their savings goals if any)
4. Warning flags if any spending is trending dangerously high
5. Progress check on savings goals (if any)
6. One positive observation about their finances`;

      const userContent = `Here is my financial data:\n\n${context}\n\n${currentMonthContext}${nwiContext}${healthContext}${goalsContext}\n\nPlease give me ${period} budget recommendations.`;

      const recommendations = await chatCompletion([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userContent,
        },
      ]);

      return NextResponse.json(
        {
          success: true,
          recommendations,
          period,
          generatedAt: new Date().toISOString(),
        },
        { status: 200, headers: corsHeaders() }
      );
    } catch (error: unknown) {
      console.error('AI recommendations error:', getErrorMessage(error));
      return NextResponse.json(
        { success: false, message: `AI recommendations failed: ${getErrorMessage(error)}` },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

export async function OPTIONS() {
  return handleOptions();
}
