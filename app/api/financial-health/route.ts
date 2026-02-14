/**
 * Financial Health API Route
 *
 * GET /api/financial-health
 * Returns a comprehensive FinancialHealthMetrics object including:
 *   - Emergency fund ratio
 *   - Expense velocity (trend analysis)
 *   - Financial freedom composite score
 *   - Net worth timeline
 *   - Income profile / stability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { corsHeaders, handleOptions, withAuth } from '@/lib/middleware';
import { TransactionType } from '@/lib/types';
import type { Transaction, FinancialHealthMetrics } from '@/lib/types';
import {
  calculateEmergencyFundRatio,
  calculateExpenseVelocity,
  calculateFinancialFreedomScore,
  calculateNetWorthTimeline,
  detectIncome,
} from '@/lib/financial-health';
import { calculateMonthlyTrends, calculateTotalByType } from '@/lib/analytics';
import { calculateAccountSummary } from '@/lib/balance-utils';
import { average } from '@/lib/utils';
import { getBalanceAtDate } from '@/lib/balance-utils';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Map a MongoDB document to a Transaction object.
 */
function mapDocToTransaction(doc: Record<string, unknown>): Transaction {
  return {
    id: (doc.txnId as string) || String(doc._id),
    date: new Date(doc.date as string),
    description: (doc.description as string) || '',
    merchant: (doc.merchant as string) || '',
    category: doc.category as Transaction['category'],
    amount: Number(doc.amount) || 0,
    type: (doc.type as Transaction['type']) || TransactionType.EXPENSE,
    paymentMethod: doc.paymentMethod as Transaction['paymentMethod'],
    account: (doc.account as string) || '',
    status: (doc.status as Transaction['status']) || 'completed',
    tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
    recurring: Boolean(doc.recurring),
    balance: doc.balance != null ? Number(doc.balance) : undefined,
  };
}

export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();

      // ------------------------------------------------------------------
      // 1. Fetch all transactions for this user
      // ------------------------------------------------------------------
      const txnDocs = await db
        .collection('transactions')
        .find({ userId: user.userId })
        .sort({ date: 1 })
        .toArray();

      const transactions: Transaction[] = txnDocs.map(doc =>
        mapDocToTransaction(doc as unknown as Record<string, unknown>)
      );

      // ------------------------------------------------------------------
      // 2. Core analytics
      // ------------------------------------------------------------------
      const accountSummary = calculateAccountSummary(transactions);
      const monthlyTrends = calculateMonthlyTrends(transactions);

      const avgMonthlyExpense =
        monthlyTrends.length > 0
          ? average(monthlyTrends.map(m => m.expenses))
          : 0;

      // ------------------------------------------------------------------
      // 3. Emergency fund ratio
      // ------------------------------------------------------------------
      const emergencyFundMonths = calculateEmergencyFundRatio(
        accountSummary.currentBalance,
        avgMonthlyExpense
      );

      // ------------------------------------------------------------------
      // 4. Expense velocity
      // ------------------------------------------------------------------
      const expenseVelocity = calculateExpenseVelocity(monthlyTrends);

      // ------------------------------------------------------------------
      // 5. Income profile
      // ------------------------------------------------------------------
      const incomeProfile = detectIncome(transactions);

      // ------------------------------------------------------------------
      // 6. Savings rate and investment rate
      // ------------------------------------------------------------------
      const totalIncome = calculateTotalByType(
        transactions.filter(t => t.status === 'completed' || !t.status),
        TransactionType.INCOME
      );
      const totalExpenses = calculateTotalByType(
        transactions.filter(t => t.status === 'completed' || !t.status),
        TransactionType.EXPENSE
      );
      const totalInvestments = calculateTotalByType(
        transactions.filter(t => t.status === 'completed' || !t.status),
        TransactionType.INVESTMENT
      );

      const savingsRate =
        totalIncome > 0
          ? ((totalIncome - totalExpenses) / totalIncome) * 100
          : 0;

      const investmentRate =
        totalIncome > 0 ? (totalInvestments / totalIncome) * 100 : 0;

      // ------------------------------------------------------------------
      // 7. NWI adherence
      // ------------------------------------------------------------------
      let nwiAdherence = 50; // default when no NWI config exists
      try {
        const nwiDoc = await db
          .collection('nwi_config')
          .findOne({ userId: user.userId });

        if (nwiDoc && nwiDoc.needs && nwiDoc.wants && nwiDoc.investments) {
          // Calculate how close actual spending split is to targets.
          // We compare expense + investment distributions against targets.
          const totalAllocated = totalExpenses + totalInvestments;

          if (totalAllocated > 0 && totalIncome > 0) {
            const needsCategories = (
              nwiDoc.needs as { categories: string[] }
            ).categories;
            const wantsCategories = (
              nwiDoc.wants as { categories: string[] }
            ).categories;
            const investmentCategories = (
              nwiDoc.investments as { categories: string[] }
            ).categories;

            const completedTransactions = transactions.filter(
              t => t.status === 'completed' || !t.status
            );

            // Sum amounts that fall into each bucket
            let needsActual = 0;
            let wantsActual = 0;
            let investmentsActual = 0;

            for (const txn of completedTransactions) {
              if (
                txn.type === TransactionType.EXPENSE ||
                txn.type === TransactionType.INVESTMENT
              ) {
                if (needsCategories.includes(txn.category)) {
                  needsActual += txn.amount;
                } else if (wantsCategories.includes(txn.category)) {
                  wantsActual += txn.amount;
                } else if (investmentCategories.includes(txn.category)) {
                  investmentsActual += txn.amount;
                } else {
                  // Uncategorised expenses go to wants by default
                  wantsActual += txn.amount;
                }
              }
            }

            const totalBuckets = needsActual + wantsActual + investmentsActual;

            if (totalBuckets > 0) {
              const needsTarget = (nwiDoc.needs as { percentage: number })
                .percentage;
              const wantsTarget = (nwiDoc.wants as { percentage: number })
                .percentage;
              const investmentsTarget = (
                nwiDoc.investments as { percentage: number }
              ).percentage;

              const needsActualPct = (needsActual / totalBuckets) * 100;
              const wantsActualPct = (wantsActual / totalBuckets) * 100;
              const investmentsActualPct =
                (investmentsActual / totalBuckets) * 100;

              // Average absolute deviation from targets
              const avgDeviation =
                (Math.abs(needsTarget - needsActualPct) +
                  Math.abs(wantsTarget - wantsActualPct) +
                  Math.abs(investmentsTarget - investmentsActualPct)) /
                3;

              // Invert: 0 deviation = 100 adherence, 33.3+ deviation = 0
              nwiAdherence = Math.max(0, Math.min(100, 100 - avgDeviation * 3));
            }
          }
        }
      } catch (nwiError) {
        // Non-critical; proceed with default
        console.warn('NWI adherence calculation failed:', nwiError);
      }

      // ------------------------------------------------------------------
      // 8. Financial freedom score
      // ------------------------------------------------------------------
      const { score: financialFreedomScore, breakdown: scoreBreakdown } =
        calculateFinancialFreedomScore({
          savingsRate,
          emergencyFundMonths,
          nwiAdherence,
          investmentRate,
        });

      // ------------------------------------------------------------------
      // 9. Net worth timeline
      // ------------------------------------------------------------------

      // 9a. Monthly bank balances from transaction balance field
      const monthlyBalances: { month: string; balance: number }[] = [];
      for (const trend of monthlyTrends) {
        const [year, month] = trend.month.split('-').map(Number);
        // End of month date
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        const balance = getBalanceAtDate(transactions, endOfMonth);
        monthlyBalances.push({ month: trend.month, balance });
      }

      // 9b. Investment values -- sum current values from all investment collections
      let totalInvestmentValue = 0;
      try {
        const [stocksDocs, mfDocs, sipDocs] = await Promise.all([
          db
            .collection('stocks')
            .find({ userId: user.userId })
            .project({ currentValue: 1, totalInvested: 1 })
            .toArray(),
          db
            .collection('mutual_funds')
            .find({ userId: user.userId })
            .project({ currentValue: 1, totalInvested: 1 })
            .toArray(),
          db
            .collection('sips')
            .find({ userId: user.userId })
            .project({ currentValue: 1, totalInvested: 1 })
            .toArray(),
        ]);

        const sumField = (
          docs: Record<string, unknown>[],
          primary: string,
          fallback: string
        ): number =>
          docs.reduce((acc, doc) => {
            const val = Number(doc[primary]) || Number(doc[fallback]) || 0;
            return acc + val;
          }, 0);

        totalInvestmentValue =
          sumField(
            stocksDocs as unknown as Record<string, unknown>[],
            'currentValue',
            'totalInvested'
          ) +
          sumField(
            mfDocs as unknown as Record<string, unknown>[],
            'currentValue',
            'totalInvested'
          ) +
          sumField(
            sipDocs as unknown as Record<string, unknown>[],
            'currentValue',
            'totalInvested'
          );
      } catch (invError) {
        console.warn('Investment value fetch failed:', invError);
      }

      // Use a single current investment total for each month (simplification:
      // historical per-month investment NAVs are not tracked).
      const investmentValues: { month: string; value: number }[] =
        monthlyTrends.map(trend => ({
          month: trend.month,
          value: totalInvestmentValue,
        }));

      const netWorthTimeline = calculateNetWorthTimeline(
        monthlyBalances,
        investmentValues
      );

      // ------------------------------------------------------------------
      // 10. Assemble response
      // ------------------------------------------------------------------
      const metrics: FinancialHealthMetrics = {
        emergencyFundMonths,
        emergencyFundTarget: 6,
        expenseVelocity,
        financialFreedomScore,
        scoreBreakdown,
        netWorthTimeline,
        incomeProfile,
      };

      return NextResponse.json(
        { success: true, metrics },
        { status: 200, headers: corsHeaders() }
      );
    } catch (error: unknown) {
      console.error('Financial health error:', getErrorMessage(error));
      return NextResponse.json(
        {
          success: false,
          message: `Failed to calculate financial health: ${getErrorMessage(error)}`,
        },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

export async function OPTIONS() {
  return handleOptions();
}
