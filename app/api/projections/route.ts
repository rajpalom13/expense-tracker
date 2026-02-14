/**
 * Growth Projections & FIRE Calculator API Route
 *
 * GET /api/projections
 * Returns comprehensive growth projections including SIP projections,
 * emergency fund progress, net worth growth, FIRE calculations,
 * and portfolio projection data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { corsHeaders, handleOptions, withAuth } from '@/lib/middleware';
import { TransactionType } from '@/lib/types';
import type { Transaction, GrowthProjection } from '@/lib/types';
import { calculateMonthlyTrends, calculateTotalByType } from '@/lib/analytics';
import { calculateAccountSummary } from '@/lib/balance-utils';
import { average, sum } from '@/lib/utils';
import {
  projectSIPFutureValue,
  projectEmergencyFundProgress,
  projectNetWorthGrowth,
  calculateFIRE,
  projectInvestmentGrowth,
} from '@/lib/projections';

// Default expected annual returns by asset class
const DEFAULT_SIP_RETURN = 12;
const DEFAULT_STOCK_RETURN = 15;
const DEFAULT_MF_RETURN = 12;
const DEFAULT_PORTFOLIO_RETURN = 12;

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

      // ----------------------------------------------------------------
      // 1. Fetch data from MongoDB in parallel
      // ----------------------------------------------------------------
      const [txnDocs, sipDocs, stockDocs, mfDocs] = await Promise.all([
        db
          .collection('transactions')
          .find({ userId: user.userId })
          .sort({ date: 1 })
          .toArray(),
        db
          .collection('sips')
          .find({ userId: user.userId, status: 'active' })
          .toArray(),
        db
          .collection('stocks')
          .find({ userId: user.userId })
          .toArray(),
        db
          .collection('mutual_funds')
          .find({ userId: user.userId })
          .toArray(),
      ]);

      // ----------------------------------------------------------------
      // 2. Map documents to typed objects
      // ----------------------------------------------------------------
      const transactions: Transaction[] = txnDocs.map(doc =>
        mapDocToTransaction(doc as unknown as Record<string, unknown>)
      );

      const sips = sipDocs.map(doc => ({
        name: (doc.name as string) || 'Unnamed SIP',
        monthlyAmount: Number(doc.monthlyAmount) || 0,
        currentValue: Number(doc.currentValue) || Number(doc.totalInvested) || 0,
        totalInvested: Number(doc.totalInvested) || 0,
        expectedAnnualReturn: Number(doc.expectedAnnualReturn) || DEFAULT_SIP_RETURN,
        status: (doc.status as string) || 'active',
      }));

      const stocks = stockDocs.map(doc => ({
        symbol: (doc.symbol as string) || '',
        companyName: (doc.companyName as string) || (doc.symbol as string) || 'Unknown',
        currentValue: Number(doc.currentValue) || Number(doc.totalInvested) || 0,
        totalInvested: Number(doc.totalInvested) || 0,
        expectedAnnualReturn: Number(doc.expectedAnnualReturn) || DEFAULT_STOCK_RETURN,
      }));

      const mutualFunds = mfDocs.map(doc => ({
        fundName: (doc.fundName as string) || 'Unknown Fund',
        currentValue: Number(doc.currentValue) || Number(doc.totalInvested) || 0,
        totalInvested: Number(doc.totalInvested) || 0,
      }));

      // ----------------------------------------------------------------
      // 3. Calculate core analytics from transactions
      // ----------------------------------------------------------------
      const completedTransactions = transactions.filter(
        t => t.status === 'completed' || !t.status
      );

      const totalIncome = calculateTotalByType(completedTransactions, TransactionType.INCOME);
      const totalExpenses = calculateTotalByType(completedTransactions, TransactionType.EXPENSE);

      const monthlyTrends = calculateMonthlyTrends(completedTransactions);
      const numMonths = Math.max(monthlyTrends.length, 1);

      const monthlySavings = (totalIncome - totalExpenses) / numMonths;
      const avgMonthlyExpense = monthlyTrends.length > 0
        ? average(monthlyTrends.map(m => m.expenses))
        : 0;

      // ----------------------------------------------------------------
      // 4. Calculate current net worth
      // ----------------------------------------------------------------
      const accountSummary = calculateAccountSummary(transactions);
      const bankBalance = accountSummary.currentBalance;

      const totalStockValue = sum(stocks.map(s => s.currentValue));
      const totalMFValue = sum(mutualFunds.map(mf => mf.currentValue));
      const totalSIPValue = sum(sips.map(s => s.currentValue));
      const totalInvestmentValue = totalStockValue + totalMFValue + totalSIPValue;

      const currentNetWorth = bankBalance + totalInvestmentValue;

      // ----------------------------------------------------------------
      // 5. SIP Projections
      // ----------------------------------------------------------------
      const sipProjections = sips.map(sip => {
        const annualReturn = sip.expectedAnnualReturn || DEFAULT_SIP_RETURN;
        return {
          name: sip.name,
          current: sip.currentValue,
          projected3y: sip.currentValue + projectSIPFutureValue(sip.monthlyAmount, annualReturn, 3),
          projected5y: sip.currentValue + projectSIPFutureValue(sip.monthlyAmount, annualReturn, 5),
          projected10y: sip.currentValue + projectSIPFutureValue(sip.monthlyAmount, annualReturn, 10),
        };
      });

      // ----------------------------------------------------------------
      // 6. Emergency Fund Progress
      // ----------------------------------------------------------------
      const emergencyFundProgress = projectEmergencyFundProgress(
        bankBalance,
        Math.max(monthlySavings, 0),
        6,
        avgMonthlyExpense
      );

      // ----------------------------------------------------------------
      // 7. Net Worth Projection (30 years, default 12% return)
      // ----------------------------------------------------------------
      const netWorthProjection = projectNetWorthGrowth(
        currentNetWorth,
        Math.max(monthlySavings, 0),
        DEFAULT_PORTFOLIO_RETURN,
        30
      );

      // ----------------------------------------------------------------
      // 8. FIRE Calculation
      // ----------------------------------------------------------------
      const annualExpenses = avgMonthlyExpense * 12;
      const fire = calculateFIRE(
        annualExpenses,
        currentNetWorth,
        Math.max(monthlySavings, 0),
        DEFAULT_PORTFOLIO_RETURN
      );

      // ----------------------------------------------------------------
      // 9. Portfolio Projection (yearly breakdown by asset class)
      // ----------------------------------------------------------------
      const projectionYears = 10;
      const portfolioProjection: GrowthProjection['portfolioProjection'] = [];

      // Calculate total monthly SIP contributions
      const totalMonthlyContribution = sum(sips.map(s => s.monthlyAmount));

      for (let y = 1; y <= projectionYears; y++) {
        // Stocks grow at stock return rate (lump sum compound growth)
        const projectedStocks = totalStockValue * Math.pow(1 + DEFAULT_STOCK_RETURN / 100, y);

        // Mutual Funds grow at MF return rate (lump sum compound growth)
        const projectedMF = totalMFValue * Math.pow(1 + DEFAULT_MF_RETURN / 100, y);

        // SIPs grow with ongoing contributions
        const projectedSIPs = totalSIPValue * Math.pow(1 + DEFAULT_SIP_RETURN / 100, y)
          + (totalMonthlyContribution > 0
            ? projectSIPFutureValue(totalMonthlyContribution, DEFAULT_SIP_RETURN, y)
            : 0);

        portfolioProjection.push({
          year: y,
          stocks: Math.round(projectedStocks * 100) / 100,
          mutualFunds: Math.round(projectedMF * 100) / 100,
          sips: Math.round(projectedSIPs * 100) / 100,
          total: Math.round((projectedStocks + projectedMF + projectedSIPs) * 100) / 100,
        });
      }

      // ----------------------------------------------------------------
      // 10. Assemble response
      // ----------------------------------------------------------------
      const projections: GrowthProjection = {
        sipProjections,
        emergencyFundProgress,
        netWorthProjection,
        fire,
        portfolioProjection,
      };

      return NextResponse.json(
        { success: true, projections },
        { status: 200, headers: corsHeaders() }
      );
    } catch (error: unknown) {
      console.error('Projections API error:', getErrorMessage(error));
      return NextResponse.json(
        {
          success: false,
          message: `Failed to calculate projections: ${getErrorMessage(error)}`,
        },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

export async function OPTIONS() {
  return handleOptions();
}
