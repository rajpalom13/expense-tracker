import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, handleOptions, withAuth } from '@/lib/middleware';
import { chatCompletion, buildInvestmentContext } from '@/lib/openrouter';
import { getMongoDb } from '@/lib/mongodb';
import type { Document } from 'mongodb';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * POST /api/ai/sip-insights
 * Gets AI-powered SIP and investment performance insights
 */
export async function POST(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();

      // Fetch SIPs, stocks, and mutual funds from MongoDB (scoped to user)
      const [sips, stocks, mutualFunds] = await Promise.all([
        db.collection('sips').find({ userId: user.userId }).toArray(),
        db.collection('stocks').find({ userId: user.userId }).toArray(),
        db.collection('mutual_funds').find({ userId: user.userId }).toArray(),
      ]);

      if (sips.length === 0 && stocks.length === 0 && mutualFunds.length === 0) {
        return NextResponse.json(
          { success: false, message: 'No investment data available. Add SIPs, stocks, or mutual funds first.' },
          { status: 404, headers: corsHeaders() }
        );
      }

      // Calculate totals
      const sipTotal = sips.reduce((acc: number, s: Document) => acc + (Number(s.monthlyAmount) || 0), 0);
      const stockInvested = stocks.reduce((acc: number, s: Document) => acc + ((Number(s.shares) || 0) * (Number(s.averageCost) || 0)), 0);
      const mfInvested = mutualFunds.reduce((acc: number, m: Document) => acc + (Number(m.investedValue) || 0), 0);
      const mfCurrent = mutualFunds.reduce((acc: number, m: Document) => acc + (Number(m.currentValue) || 0), 0);
      const stockCurrent = stocks.reduce((acc: number, s: Document) => {
        const currentPrice = Number(s.currentPrice) || Number(s.averageCost) || 0;
        return acc + ((Number(s.shares) || 0) * currentPrice);
      }, 0);

      const totalInvested = stockInvested + mfInvested;
      const totalCurrentValue = stockCurrent + mfCurrent;

      const context = buildInvestmentContext({
        sips: sips.map((s: Document) => ({
          name: String(s.name || ''),
          monthly: Number(s.monthlyAmount) || 0,
          provider: String(s.provider || 'Unknown'),
          status: String(s.status || 'active'),
        })),
        stocks: stocks.map((s: Document) => ({
          symbol: String(s.symbol || ''),
          shares: Number(s.shares) || 0,
          avgCost: Number(s.averageCost) || 0,
          currentPrice: s.currentPrice ? Number(s.currentPrice) : undefined,
        })),
        mutualFunds: mutualFunds.map((m: Document) => ({
          name: String(m.schemeName || m.name || ''),
          invested: Number(m.investedValue) || 0,
          current: Number(m.currentValue) || 0,
          returns: Number(m.returns) || 0,
        })),
        totalInvested,
        totalCurrentValue,
      });

      // Fetch NWI config for investment allocation context
      const nwiConfigDoc = await db.collection('nwi_config').findOne({ userId: user.userId });
      let nwiContext = '';
      if (nwiConfigDoc) {
        nwiContext = `\n\nNeeds/Wants/Investments Split Configuration:
- Needs (${nwiConfigDoc.needs.percentage}%): ${nwiConfigDoc.needs.categories.join(', ')}
- Wants (${nwiConfigDoc.wants.percentage}%): ${nwiConfigDoc.wants.categories.join(', ')}
- Investments (${nwiConfigDoc.investments.percentage}%): ${nwiConfigDoc.investments.categories.join(', ')}`;
      }

      // Financial health summary from transactions
      let healthContext = '';
      try {
        const txnDocs = await db
          .collection('transactions')
          .find({ userId: user.userId })
          .sort({ date: -1 })
          .toArray();
        if (txnDocs.length > 0) {
          const totalIncome = txnDocs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const totalExpenses = txnDocs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0';
          healthContext = `\n\nFinancial Health Summary:
- Savings Rate: ${savingsRate}%
- Total Income: Rs.${totalIncome.toLocaleString('en-IN')}
- Total Expenses: Rs.${totalExpenses.toLocaleString('en-IN')}`;
        }
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

      const systemPrompt = `You are an Indian investment advisor. Analyze the user's investment portfolio and provide insights.
Use INR (Rs.) for all amounts. Be specific and actionable. Format as markdown.

Provide:
1. Portfolio health assessment
2. Diversification analysis (are they too concentrated?)
3. SIP optimization suggestions (increase/decrease/rebalance)
4. Risk assessment for their stock holdings
5. Mutual fund performance commentary
6. Whether investment allocation matches their NWI split target (if configured)
7. How investments contribute to savings goals progress (if any)
8. One actionable recommendation they can execute this week`;

      const userContent = `Here is my investment portfolio:\n\n${context}${nwiContext}${healthContext}${goalsContext}\n\nPlease analyze and provide insights.`;

      const insights = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ]);

      return NextResponse.json(
        {
          success: true,
          insights,
          generatedAt: new Date().toISOString(),
          portfolio: {
            totalInvested,
            totalCurrentValue,
            returns: totalCurrentValue - totalInvested,
            sipsCount: sips.length,
            stocksCount: stocks.length,
            mutualFundsCount: mutualFunds.length,
            monthlySipCommitment: sipTotal,
          },
        },
        { status: 200, headers: corsHeaders() }
      );
    } catch (error: unknown) {
      console.error('AI sip-insights error:', getErrorMessage(error));
      return NextResponse.json(
        { success: false, message: `AI investment insights failed: ${getErrorMessage(error)}` },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

export async function OPTIONS() {
  return handleOptions();
}
