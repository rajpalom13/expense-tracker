import { getMongoDb } from './mongodb';
import { calculateAnalytics, separateOneTimeExpenses } from './analytics';
import { calculateAccountSummary } from './balance-utils';
import { calculateMonthlyMetrics, getCurrentMonth } from './monthly-utils';
import { chatCompletion, buildFinancialContext, buildInvestmentContext } from './openrouter';
import { getSystemPrompt, buildUserMessage } from './ai-prompts';
import { searchMarketContext } from './ai-search';
import { calculateTax, getDefaultTaxConfig } from '@/lib/tax';
import type { TaxConfig } from '@/lib/tax';
import type { Transaction, TransactionCategory, TransactionType, PaymentMethod, TransactionStatus } from './types';
import type { AiInsightType, AiAnalysisDoc, InsightSection, PipelineContext, PipelineOptions, PipelineResult, TaxTipData, SpendingAnalysisData, MonthlyBudgetData, WeeklyBudgetData, InvestmentInsightsData, PlannerRecommendationData } from './ai-types';
import type { Document } from 'mongodb';

const STALENESS_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ANALYSES_PER_TYPE = 5;

function toTransaction(doc: Record<string, unknown>): Transaction {
  return {
    id: (doc.txnId as string) || (doc._id as { toString(): string })?.toString() || '',
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

function isStale(doc: AiAnalysisDoc): boolean {
  const generatedAt = new Date(doc.generatedAt).getTime();
  return Date.now() - generatedAt > STALENESS_MS;
}

export async function getCachedAnalysis(
  userId: string,
  type: AiInsightType
): Promise<(AiAnalysisDoc & { stale: boolean }) | null> {
  const db = await getMongoDb();
  const doc = await db
    .collection('ai_analyses')
    .findOne(
      { userId, type },
      { sort: { generatedAt: -1 } }
    );

  if (!doc) return null;

  const analysis: AiAnalysisDoc = {
    _id: doc._id.toString(),
    userId: doc.userId as string,
    type: doc.type as AiInsightType,
    content: doc.content as string,
    sections: (doc.sections as InsightSection[] | undefined) || undefined,
    structuredData: (doc.structuredData as Record<string, unknown> | undefined) || undefined,
    generatedAt: doc.generatedAt as string,
    dataPoints: doc.dataPoints as number,
    searchContext: doc.searchContext as AiAnalysisDoc['searchContext'],
    createdAt: doc.createdAt as string,
  };

  return { ...analysis, stale: isStale(analysis) };
}

// Stage 1: Collect user data from MongoDB
async function collectUserData(
  userId: string,
  type: AiInsightType
): Promise<PipelineContext> {
  const db = await getMongoDb();

  // Always fetch transactions
  const txnDocs = await db
    .collection('transactions')
    .find({ userId })
    .sort({ date: -1 })
    .toArray();

  const transactions = txnDocs.map((d) => toTransaction(d as Record<string, unknown>));

  // Calculate analytics from transactions
  let financialContext = '';
  let currentMonthContext = '';
  let healthContext = '';

  if (transactions.length > 0) {
    const analytics = calculateAnalytics(transactions);
    const accountSummary = calculateAccountSummary(transactions);
    const separated = separateOneTimeExpenses(transactions);

    financialContext = buildFinancialContext({
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

    // Current month context for budget types
    if (type === 'monthly_budget' || type === 'weekly_budget') {
      const { year, month } = getCurrentMonth();
      const metrics = calculateMonthlyMetrics(transactions, year, month);
      currentMonthContext = `## Current Month (${metrics.monthLabel})
- Opening Balance: Rs.${metrics.openingBalance.toLocaleString('en-IN')}
- Income so far: Rs.${metrics.totalIncome.toLocaleString('en-IN')}
- Expenses so far: Rs.${metrics.totalExpenses.toLocaleString('en-IN')}
- Days elapsed: ${metrics.daysInPeriod}
- Partial month: ${metrics.isPartialMonth ? 'Yes' : 'No'}`;
    }

    // Health context
    const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : '0';
    healthContext = `Financial Health Summary:
- Savings Rate: ${savingsRate}%
- Total Income: Rs.${totalIncome.toLocaleString('en-IN')}
- Total Expenses: Rs.${totalExpenses.toLocaleString('en-IN')}`;
  }

  // Fetch NWI config
  const nwiConfigDoc = await db.collection('nwi_config').findOne({ userId });
  let nwiContext = '';
  if (nwiConfigDoc) {
    const lines = [
      `Needs/Wants/Investments/Savings Split Configuration:`,
      `- Needs (${nwiConfigDoc.needs.percentage}%): ${nwiConfigDoc.needs.categories.join(', ')}`,
      `- Wants (${nwiConfigDoc.wants.percentage}%): ${nwiConfigDoc.wants.categories.join(', ')}`,
      `- Investments (${nwiConfigDoc.investments.percentage}%): ${nwiConfigDoc.investments.categories.join(', ')}`,
    ];
    if (nwiConfigDoc.savings) {
      lines.push(`- Savings (${nwiConfigDoc.savings.percentage}%): ${nwiConfigDoc.savings.categories.join(', ')}`);
    }
    nwiContext = lines.join('\n');
  }

  // Fetch savings goals
  const goalsDocs = await db.collection('savings_goals').find({ userId }).toArray();
  let goalsContext = '';
  if (goalsDocs.length > 0) {
    const goalsList = goalsDocs.map((g) =>
      `  - ${g.name}: Rs.${g.currentAmount?.toLocaleString('en-IN') || 0} / Rs.${g.targetAmount?.toLocaleString('en-IN')} (target: ${g.targetDate})`
    ).join('\n');
    goalsContext = `Savings Goals:\n${goalsList}`;
  }

  // Fetch investment data
  const [stocks, mutualFunds, sips] = await Promise.all([
    db.collection('stocks').find({ userId }).toArray(),
    db.collection('mutual_funds').find({ userId }).toArray(),
    db.collection('sips').find({ userId }).toArray(),
  ]);

  let investmentContext = '';
  const stockSymbols: string[] = [];
  const mutualFundNames: string[] = [];

  if (stocks.length > 0 || mutualFunds.length > 0 || sips.length > 0) {
    const stockInvested = stocks.reduce((a: number, s: Document) => a + ((Number(s.shares) || 0) * (Number(s.averageCost) || 0)), 0);
    const stockCurrent = stocks.reduce((a: number, s: Document) => {
      const price = Number(s.currentPrice) || Number(s.averageCost) || 0;
      return a + ((Number(s.shares) || 0) * price);
    }, 0);
    const mfInvested = mutualFunds.reduce((a: number, m: Document) => a + (Number(m.investedValue) || 0), 0);
    const mfCurrent = mutualFunds.reduce((a: number, m: Document) => a + (Number(m.currentValue) || 0), 0);

    investmentContext = buildInvestmentContext({
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
      totalInvested: stockInvested + mfInvested,
      totalCurrentValue: stockCurrent + mfCurrent,
    });

    for (const s of stocks) {
      if (s.symbol) stockSymbols.push(String(s.symbol));
    }
    for (const m of mutualFunds) {
      const name = String(m.schemeName || m.name || '');
      if (name) mutualFundNames.push(name);
    }
  }

  // Fetch planner data for planner_recommendation insights
  let plannerContext = '';
  if (type === 'planner_recommendation') {
    const planDoc = await db.collection('finance_plans').findOne({ userId });
    if (planDoc) {
      const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;
      const income = Number(planDoc.monthlyIncome) || 0;
      const planNeeds = Number(planDoc.needs) || 0;
      const planWants = Number(planDoc.wants) || 0;
      const planSavings = Number(planDoc.savings) || 0;
      const investments = planDoc.investments as Record<string, number> | undefined;
      const totalInv = investments ? Object.values(investments).reduce((s: number, v: unknown) => s + (Number(v) || 0), 0) : 0;

      const lines: string[] = [
        `## Financial Plan`,
        `- Monthly Income: ${fmt(income)}`,
        `- Needs: ${fmt(planNeeds)} (${income > 0 ? ((planNeeds / income) * 100).toFixed(1) : 0}%)`,
        `- Wants: ${fmt(planWants)} (${income > 0 ? ((planWants / income) * 100).toFixed(1) : 0}%)`,
        `- Savings: ${fmt(planSavings)} (${income > 0 ? ((planSavings / income) * 100).toFixed(1) : 0}%)`,
        `- Investments: ${fmt(totalInv)} (${income > 0 ? ((totalInv / income) * 100).toFixed(1) : 0}%)`,
      ];

      if (investments) {
        const invLines = Object.entries(investments)
          .filter(([, v]) => Number(v) > 0)
          .map(([k, v]) => `  - ${k}: ${fmt(Number(v))}`);
        if (invLines.length > 0) {
          lines.push(`- Investment Breakdown:`);
          lines.push(...invLines);
        }
      }

      const totalAllocated = planNeeds + planWants + planSavings + totalInv;
      const unallocated = income - totalAllocated;
      if (unallocated > 0) {
        lines.push(`- Unallocated: ${fmt(unallocated)} (${((unallocated / income) * 100).toFixed(1)}%)`);
      } else if (unallocated < 0) {
        lines.push(`- Over-allocated by: ${fmt(Math.abs(unallocated))}`);
      }

      // Goal allocations from plan
      const goalAllocations = planDoc.goalAllocations as Record<string, number> | undefined;
      if (goalAllocations) {
        const goalLines = Object.entries(goalAllocations)
          .filter(([, v]) => Number(v) > 0)
          .map(([name, v]) => `  - ${name}: ${fmt(Number(v))}/mo`);
        if (goalLines.length > 0) {
          lines.push(`- Goal Allocations from Savings:`);
          lines.push(...goalLines);
        }
      }

      plannerContext = lines.join('\n');
    }
  }

  // Fetch tax config for tax_optimization insights
  let taxContext = '';
  if (type === 'tax_optimization') {
    const taxConfigDoc = await db.collection('tax_config').findOne({ userId });
    const taxConfig: TaxConfig = taxConfigDoc
      ? {
          grossAnnualIncome: Number(taxConfigDoc.grossAnnualIncome) || 0,
          otherIncome: {
            fdInterest: Number(taxConfigDoc.otherIncome?.fdInterest) || 0,
            capitalGainsSTCG: Number(taxConfigDoc.otherIncome?.capitalGainsSTCG) || 0,
            capitalGainsLTCG: Number(taxConfigDoc.otherIncome?.capitalGainsLTCG) || 0,
            rentalIncome: Number(taxConfigDoc.otherIncome?.rentalIncome) || 0,
            otherSources: Number(taxConfigDoc.otherIncome?.otherSources) || 0,
          },
          deductions80C: {
            ppf: Number(taxConfigDoc.deductions80C?.ppf) || 0,
            elss: Number(taxConfigDoc.deductions80C?.elss) || 0,
            lic: Number(taxConfigDoc.deductions80C?.lic) || 0,
            epf: Number(taxConfigDoc.deductions80C?.epf) || 0,
            tuitionFees: Number(taxConfigDoc.deductions80C?.tuitionFees) || 0,
            homeLoanPrincipal: Number(taxConfigDoc.deductions80C?.homeLoanPrincipal) || 0,
            nsc: Number(taxConfigDoc.deductions80C?.nsc) || 0,
            others: Number(taxConfigDoc.deductions80C?.others) || 0,
          },
          deductions80D: {
            selfHealthInsurance: Number(taxConfigDoc.deductions80D?.selfHealthInsurance) || 0,
            parentsHealthInsurance: Number(taxConfigDoc.deductions80D?.parentsHealthInsurance) || 0,
            parentsAreSenior: Boolean(taxConfigDoc.deductions80D?.parentsAreSenior),
          },
          section80TTA: Number(taxConfigDoc.section80TTA) || 0,
          section24HomeLoan: Number(taxConfigDoc.section24HomeLoan) || 0,
          section80E: Number(taxConfigDoc.section80E) || 0,
          section80CCD1B: Number(taxConfigDoc.section80CCD1B) || 0,
          hra: {
            basicSalary: Number(taxConfigDoc.hra?.basicSalary) || 0,
            hraReceived: Number(taxConfigDoc.hra?.hraReceived) || 0,
            rentPaid: Number(taxConfigDoc.hra?.rentPaid) || 0,
            isMetroCity: Boolean(taxConfigDoc.hra?.isMetroCity),
          },
          preferredRegime: taxConfigDoc.preferredRegime || 'auto',
        }
      : getDefaultTaxConfig();

    const taxResult = calculateTax(taxConfig);
    const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;

    const total80C =
      taxConfig.deductions80C.ppf +
      taxConfig.deductions80C.elss +
      taxConfig.deductions80C.lic +
      taxConfig.deductions80C.epf +
      taxConfig.deductions80C.tuitionFees +
      taxConfig.deductions80C.homeLoanPrincipal +
      taxConfig.deductions80C.nsc +
      taxConfig.deductions80C.others;

    const total80D = taxResult.old.total80D;

    const taxLines: string[] = [
      `## Tax Analysis (FY 2025-26)`,
      ``,
      `### Income`,
      `- Gross Annual Income: ${fmt(taxConfig.grossAnnualIncome)}`,
    ];

    const otherTotal =
      taxConfig.otherIncome.fdInterest +
      taxConfig.otherIncome.capitalGainsSTCG +
      taxConfig.otherIncome.capitalGainsLTCG +
      taxConfig.otherIncome.rentalIncome +
      taxConfig.otherIncome.otherSources;
    if (otherTotal > 0) {
      taxLines.push(`- Other Income: ${fmt(otherTotal)}`);
    }

    taxLines.push(
      ``,
      `### Deductions (Old Regime)`,
      `- 80C (${fmt(total80C)} of Rs.1,50,000 limit):`,
    );
    if (taxConfig.deductions80C.ppf > 0) taxLines.push(`  - PPF: ${fmt(taxConfig.deductions80C.ppf)}`);
    if (taxConfig.deductions80C.elss > 0) taxLines.push(`  - ELSS: ${fmt(taxConfig.deductions80C.elss)}`);
    if (taxConfig.deductions80C.lic > 0) taxLines.push(`  - LIC: ${fmt(taxConfig.deductions80C.lic)}`);
    if (taxConfig.deductions80C.epf > 0) taxLines.push(`  - EPF: ${fmt(taxConfig.deductions80C.epf)}`);
    if (taxConfig.deductions80C.tuitionFees > 0) taxLines.push(`  - Tuition Fees: ${fmt(taxConfig.deductions80C.tuitionFees)}`);
    if (taxConfig.deductions80C.homeLoanPrincipal > 0) taxLines.push(`  - Home Loan Principal: ${fmt(taxConfig.deductions80C.homeLoanPrincipal)}`);
    if (taxConfig.deductions80C.nsc > 0) taxLines.push(`  - NSC: ${fmt(taxConfig.deductions80C.nsc)}`);
    if (taxConfig.deductions80C.others > 0) taxLines.push(`  - Others: ${fmt(taxConfig.deductions80C.others)}`);

    taxLines.push(
      `- 80D (Health Insurance): ${fmt(total80D)}`,
      `  - Self: ${fmt(taxConfig.deductions80D.selfHealthInsurance)}`,
      `  - Parents: ${fmt(taxConfig.deductions80D.parentsHealthInsurance)}${taxConfig.deductions80D.parentsAreSenior ? ' (Senior Citizen)' : ''}`,
    );
    if (taxConfig.section80TTA > 0) taxLines.push(`- 80TTA (Savings Interest): ${fmt(taxConfig.section80TTA)}`);
    if (taxConfig.section80E > 0) taxLines.push(`- 80E (Education Loan): ${fmt(taxConfig.section80E)}`);
    if (taxConfig.section80CCD1B > 0) taxLines.push(`- 80CCD(1B) (NPS): ${fmt(taxConfig.section80CCD1B)}`);
    if (taxConfig.section24HomeLoan > 0) taxLines.push(`- Sec 24 (Home Loan Interest): ${fmt(taxConfig.section24HomeLoan)}`);

    if (taxConfig.hra.rentPaid > 0) {
      taxLines.push(
        ``,
        `### HRA Details`,
        `- Basic Salary: ${fmt(taxConfig.hra.basicSalary)}`,
        `- HRA Received: ${fmt(taxConfig.hra.hraReceived)}`,
        `- Rent Paid: ${fmt(taxConfig.hra.rentPaid)}`,
        `- Metro City: ${taxConfig.hra.isMetroCity ? 'Yes' : 'No'}`,
        `- HRA Exemption: ${fmt(taxResult.old.hraExemption)}`,
      );
    }

    taxLines.push(
      ``,
      `### Regime Comparison`,
      `- Old Regime Tax: ${fmt(taxResult.old.totalTax)} (Effective Rate: ${taxResult.old.effectiveRate.toFixed(1)}%)`,
      `- New Regime Tax: ${fmt(taxResult.new.totalTax)} (Effective Rate: ${taxResult.new.effectiveRate.toFixed(1)}%)`,
      `- Recommended Regime: ${taxResult.recommended === 'old' ? 'Old' : 'New'} Regime`,
      `- Tax Saved by Choosing Better Regime: ${fmt(taxResult.savings)}`,
      ``,
      `### Utilization Summary`,
      `- 80C: ${fmt(Math.min(total80C, 150_000))} of Rs.1,50,000 used (${fmt(Math.max(0, 150_000 - total80C))} remaining)`,
      `- 80D: ${fmt(total80D)} used`,
    );

    taxContext = taxLines.join('\n');

    // Fetch recurring/subscription transactions for subscription analysis
    const recurringTxns = await db
      .collection('transactions')
      .find({ userId, recurring: true, type: 'expense' })
      .sort({ date: -1 })
      .toArray();

    if (recurringTxns.length > 0) {
      // Group by merchant/description to identify subscriptions
      const subscriptionMap = new Map<string, { total: number; count: number; latest: string }>();
      for (const txn of recurringTxns) {
        const key = (txn.merchant as string) || (txn.description as string) || 'Unknown';
        const existing = subscriptionMap.get(key);
        if (existing) {
          existing.total += Number(txn.amount) || 0;
          existing.count += 1;
        } else {
          subscriptionMap.set(key, {
            total: Number(txn.amount) || 0,
            count: 1,
            latest: String(txn.date),
          });
        }
      }

      const subLines: string[] = [``, `### Recurring Subscriptions & Services`];
      for (const [name, data] of subscriptionMap) {
        const avg = Math.round(data.total / data.count);
        subLines.push(`- ${name}: ~Rs.${avg.toLocaleString('en-IN')}/txn (${data.count} transactions, total Rs.${data.total.toLocaleString('en-IN')})`);
      }
      taxContext += '\n' + subLines.join('\n');
    }
  }

  return {
    userId,
    financialContext,
    investmentContext,
    nwiContext,
    healthContext,
    goalsContext,
    currentMonthContext,
    transactionCount: transactions.length,
    marketContext: '', // filled in Stage 2
    stockSymbols,
    mutualFundNames,
    taxContext,
    plannerContext,
  };
}

/**
 * Build backward-compatible InsightSection[] and markdown from TaxTipData.
 */
function taxTipToSections(data: TaxTipData): { sections: InsightSection[]; content: string } {
  const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;
  const sections: InsightSection[] = [];

  sections.push({
    id: 'current_status',
    title: 'Tax Status',
    type: 'summary',
    text: `Recommended regime: **${data.regime.recommended === 'old' ? 'Old' : 'New'}**. Old regime tax: ${fmt(data.regime.oldTax)}, New regime tax: ${fmt(data.regime.newTax)}. You save ${fmt(data.regime.savings)} with the ${data.regime.recommended} regime (effective rate: ${data.regime.effectiveRate.toFixed(1)}%).`,
    severity: data.regime.savings > 0 ? 'positive' : 'neutral',
  });

  if (data.deductionUtilization.length > 0) {
    sections.push({
      id: 'deduction_utilization',
      title: 'Deduction Utilization',
      type: 'list',
      items: data.deductionUtilization.map(
        (d) => `**${d.section}** (${d.label}): ${fmt(d.used)} of ${fmt(d.limit)} used (${fmt(Math.max(0, d.limit - d.used))} remaining)`
      ),
      severity: data.deductionUtilization.some((d) => d.used < d.limit * 0.5) ? 'warning' : 'positive',
    });
  }

  if (data.tips.length > 0) {
    sections.push({
      id: 'action_plan',
      title: 'Tax-Saving Tips',
      type: 'numbered_list',
      items: data.tips.map(
        (t) => `**${t.title}** — ${t.description} (saves ${fmt(t.savingAmount)}, Section ${t.section})`
      ),
      severity: 'positive',
    });
  }

  if (data.subscriptions && data.subscriptions.length > 0) {
    sections.push({
      id: 'subscriptions',
      title: 'Subscription Optimization',
      type: 'list',
      items: data.subscriptions.map(
        (s) => `**${s.name}** (${s.domain}): ${fmt(s.monthlyCost)}/mo — ${s.suggestion}`
      ),
      severity: 'neutral',
    });
  }

  sections.push({
    id: 'total_savings',
    title: 'Total Savings Potential',
    type: 'highlight',
    highlight: `You can save up to **${fmt(data.totalSavingPotential)}** in tax this year.`,
    severity: 'positive',
  });

  return { sections, content: sectionsToMarkdown(sections) };
}

/**
 * Build backward-compatible InsightSection[] and markdown from SpendingAnalysisData.
 */
function spendingToSections(data: SpendingAnalysisData): { sections: InsightSection[]; content: string } {
  const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;
  const sections: InsightSection[] = [];

  sections.push({
    id: 'overview',
    title: 'Financial Health Overview',
    type: 'summary',
    text: `Health Score: **${data.healthScore}/100**. ${data.summary.verdict} Income: ${fmt(data.summary.income)}, Expenses: ${fmt(data.summary.expenses)}, Savings: ${fmt(data.summary.savings)} (${data.summary.savingsRate.toFixed(1)}%).`,
    severity: data.healthScore >= 75 ? 'positive' : data.healthScore >= 50 ? 'warning' : 'critical',
  });

  if (data.topCategories.length > 0) {
    sections.push({
      id: 'spending_patterns',
      title: 'Top Spending Categories',
      type: 'list',
      items: data.topCategories.map(
        (c) => `**${c.name}**: ${fmt(c.amount)} (${c.percentage.toFixed(1)}%) — trend: ${c.trend}${c.suggestion ? `. ${c.suggestion}` : ''}`
      ),
      severity: 'neutral',
    });
  }

  if (data.actionItems.length > 0) {
    sections.push({
      id: 'areas_to_optimize',
      title: 'Action Items',
      type: 'numbered_list',
      items: data.actionItems.map(
        (a) => `**${a.title}**: ${a.description} (impact: ${a.impact}, saves ~${fmt(a.savingAmount)}/mo)`
      ),
      severity: 'warning',
    });
  }

  if (data.alerts.length > 0) {
    sections.push({
      id: 'risk_flags',
      title: 'Alerts',
      type: 'list',
      items: data.alerts.map((a) => `[${a.type.toUpperCase()}] **${a.title}**: ${a.message}`),
      severity: data.alerts.some((a) => a.type === 'critical') ? 'critical' : 'warning',
    });
  }

  sections.push({
    id: 'key_takeaway',
    title: 'Key Insight',
    type: 'highlight',
    highlight: data.keyInsight,
    severity: 'positive',
  });

  return { sections, content: sectionsToMarkdown(sections) };
}

/**
 * Build backward-compatible InsightSection[] and markdown from MonthlyBudgetData.
 */
function monthlyBudgetToSections(data: MonthlyBudgetData): { sections: InsightSection[]; content: string } {
  const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;
  const sections: InsightSection[] = [];

  sections.push({
    id: 'budget_overview',
    title: 'Monthly Budget Overview',
    type: 'summary',
    text: `Income: ${fmt(data.totalIncome)}, Budget: ${fmt(data.totalBudget)}, Surplus: ${fmt(data.surplus)}. Needs: ${data.needs.percentage.toFixed(0)}% | Wants: ${data.wants.percentage.toFixed(0)}% | Savings: ${data.savingsInvestments.percentage.toFixed(0)}%.`,
    severity: data.surplus >= 0 ? 'positive' : 'critical',
  });

  const buckets = [
    { label: 'Needs', bucket: data.needs },
    { label: 'Wants', bucket: data.wants },
    { label: 'Savings & Investments', bucket: data.savingsInvestments },
  ];
  for (const { label, bucket } of buckets) {
    if (bucket.categories.length > 0) {
      sections.push({
        id: label.toLowerCase().replace(/\s+/g, '_'),
        title: `${label} (${fmt(bucket.total)})`,
        type: 'list',
        items: bucket.categories.map(
          (c) => `**${c.name}**: Budget ${fmt(c.budgeted)}, Actual ${fmt(c.actual)} — ${c.status.replace('_', ' ')}`
        ),
        severity: bucket.categories.some((c) => c.status === 'over') ? 'warning' : 'positive',
      });
    }
  }

  if (data.savingsOpportunities.length > 0) {
    sections.push({
      id: 'savings_opportunities',
      title: 'Savings Opportunities',
      type: 'numbered_list',
      items: data.savingsOpportunities.map((o) => `**${o.title}**: ${o.description} (save ~${fmt(o.amount)}/mo)`),
      severity: 'positive',
    });
  }

  if (data.positiveNote) {
    sections.push({ id: 'positive_note', title: 'Positive Note', type: 'highlight', highlight: data.positiveNote, severity: 'positive' });
  }

  return { sections, content: sectionsToMarkdown(sections) };
}

/**
 * Build backward-compatible InsightSection[] and markdown from WeeklyBudgetData.
 */
function weeklyBudgetToSections(data: WeeklyBudgetData): { sections: InsightSection[]; content: string } {
  const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;
  const sections: InsightSection[] = [];

  sections.push({
    id: 'week_glance',
    title: 'Week at a Glance',
    type: 'summary',
    text: `Target: ${fmt(data.weeklyTarget)}, Spent: ${fmt(data.spent)}, Remaining: ${fmt(data.remaining)}. Daily limit: ${fmt(data.dailyLimit)}. ${data.daysRemaining} days left. ${data.onTrack ? 'On track!' : 'Over budget — cut back.'}`,
    severity: data.onTrack ? 'positive' : 'warning',
  });

  if (data.categories.length > 0) {
    sections.push({
      id: 'category_budgets',
      title: 'Category Budgets',
      type: 'list',
      items: data.categories.map(
        (c) => `**${c.name}**: ${fmt(c.spent)} of ${fmt(c.weeklyBudget)} (${fmt(c.remaining)} left) — ${c.status.replace('_', ' ')}`
      ),
      severity: data.categories.some((c) => c.status === 'over') ? 'warning' : 'neutral',
    });
  }

  if (data.quickWins.length > 0) {
    sections.push({
      id: 'quick_wins',
      title: 'Quick Wins',
      type: 'numbered_list',
      items: data.quickWins.map((q) => `**${q.title}**: ${q.description} (save ~${fmt(q.savingAmount)})`),
      severity: 'positive',
    });
  }

  if (data.weeklyRule) {
    sections.push({ id: 'weekly_rule', title: 'Rule of the Week', type: 'highlight', highlight: data.weeklyRule, severity: 'neutral' });
  }

  return { sections, content: sectionsToMarkdown(sections) };
}

/**
 * Build backward-compatible InsightSection[] and markdown from InvestmentInsightsData.
 */
function investmentToSections(data: InvestmentInsightsData): { sections: InsightSection[]; content: string } {
  const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;
  const sections: InsightSection[] = [];

  sections.push({
    id: 'portfolio_health',
    title: 'Portfolio Health',
    type: 'summary',
    text: `Value: ${fmt(data.portfolioValue)}, Invested: ${fmt(data.totalInvested)}, Returns: ${fmt(data.totalReturns)} (${data.returnPercentage.toFixed(1)}%)${data.xirr != null ? `, XIRR: ${data.xirr.toFixed(1)}%` : ''}. ${data.verdict}`,
    severity: data.returnPercentage >= 0 ? 'positive' : 'critical',
  });

  if (data.stocks.length > 0) {
    sections.push({
      id: 'stock_analysis',
      title: 'Stock Analysis',
      type: 'list',
      items: data.stocks.map(
        (s) => `**${s.symbol}** (${s.name}): ${fmt(s.currentValue)} (${s.returnPercentage >= 0 ? '+' : ''}${s.returnPercentage.toFixed(1)}%) — ${s.recommendation}`
      ),
      severity: 'neutral',
    });
  }

  if (data.mutualFunds.length > 0) {
    sections.push({
      id: 'mf_review',
      title: 'Mutual Fund Review',
      type: 'list',
      items: data.mutualFunds.map(
        (f) => `**${f.name}**: ${fmt(f.currentValue)} (${f.returnPercentage >= 0 ? '+' : ''}${f.returnPercentage.toFixed(1)}%)${f.sipAmount > 0 ? `, SIP ${fmt(f.sipAmount)}/mo` : ''} — ${f.recommendation}`
      ),
      severity: 'neutral',
    });
  }

  if (data.actionItems.length > 0) {
    sections.push({
      id: 'action_items',
      title: 'Action Items',
      type: 'numbered_list',
      items: data.actionItems.map((a) => `**${a.title}**: ${a.description} (${a.priority} priority)`),
      severity: 'warning',
    });
  }

  if (data.goalAlignment) {
    sections.push({ id: 'goal_alignment', title: 'Goal Alignment', type: 'highlight', highlight: data.goalAlignment, severity: 'positive' });
  }

  return { sections, content: sectionsToMarkdown(sections) };
}

/**
 * Build backward-compatible InsightSection[] and markdown from PlannerRecommendationData.
 */
function plannerToSections(data: PlannerRecommendationData): { sections: InsightSection[]; content: string } {
  const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;
  const sections: InsightSection[] = [];

  sections.push({
    id: 'plan_overview',
    title: 'Plan Health',
    type: 'summary',
    text: `Plan Score: **${data.planScore}/100**. ${data.summary}`,
    severity: data.planScore >= 75 ? 'positive' : data.planScore >= 50 ? 'warning' : 'critical',
  });

  sections.push({
    id: 'allocation_review',
    title: 'Allocation Review',
    type: 'summary',
    text: `Needs: **${data.allocationReview.needsPct.toFixed(0)}%** | Wants: **${data.allocationReview.wantsPct.toFixed(0)}%** | Investments: **${data.allocationReview.investmentsPct.toFixed(0)}%** | Savings: **${data.allocationReview.savingsPct.toFixed(0)}%**. ${data.allocationReview.verdict}`,
    severity: data.allocationReview.severity,
  });

  if (data.planVsActual.length > 0) {
    sections.push({
      id: 'plan_vs_actual',
      title: 'Plan vs Actual',
      type: 'list',
      items: data.planVsActual.map(
        (p) => `**${p.category}**: Planned ${fmt(p.planned)}, Actual ${fmt(p.actual)} (${p.deviation >= 0 ? '+' : ''}${p.deviation.toFixed(0)}%) — ${p.status.replace('_', ' ')}`
      ),
      severity: data.planVsActual.some((p) => p.status === 'over') ? 'warning' : 'positive',
    });
  }

  if (data.goalFeasibility.length > 0) {
    sections.push({
      id: 'goal_feasibility',
      title: 'Goal Feasibility',
      type: 'list',
      items: data.goalFeasibility.map(
        (g) => `**${g.goalName}**: ${fmt(g.currentAmount)} of ${fmt(g.targetAmount)} (${g.monthlySaving > 0 ? `${g.monthsToGoal} months at ${fmt(g.monthlySaving)}/mo` : 'no monthly saving'}) — ${g.feasible ? 'On track' : 'At risk'}. ${g.suggestion}`
      ),
      severity: data.goalFeasibility.some((g) => !g.feasible) ? 'warning' : 'positive',
    });
  }

  if (data.recommendations.length > 0) {
    sections.push({
      id: 'recommendations',
      title: 'Recommendations',
      type: 'numbered_list',
      items: data.recommendations.map(
        (r) => `**${r.title}**: ${r.description} (${r.impact} impact)`
      ),
      severity: 'neutral',
    });
  }

  sections.push({
    id: 'key_takeaway',
    title: 'Key Takeaway',
    type: 'highlight',
    highlight: data.keyTakeaway,
    severity: 'positive',
  });

  return { sections, content: sectionsToMarkdown(sections) };
}

/**
 * Convert InsightSection[] to markdown string.
 */
function sectionsToMarkdown(sections: InsightSection[]): string {
  const lines: string[] = [];
  for (const sec of sections) {
    lines.push(`## ${sec.title}`);
    if (sec.text) lines.push(sec.text);
    if (sec.items) {
      for (let i = 0; i < sec.items.length; i++) {
        lines.push(sec.type === 'numbered_list' ? `${i + 1}. ${sec.items[i]}` : `- ${sec.items[i]}`);
      }
    }
    if (sec.highlight) lines.push(`**${sec.highlight}**`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Try to extract a JSON object from a string that may contain surrounding text.
 * Looks for the outermost { ... } pair.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Parse AI response as structured JSON.
 * Detects type-specific formats and falls back gracefully if the response isn't valid JSON.
 */
function parseAiResponse(raw: string): { sections?: InsightSection[]; content: string; structuredData?: Record<string, unknown> } {
  // Strip code fences if AI wrapped JSON in ```json ... ```
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try direct parse first, then fall back to extracting JSON object from surrounding text
  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Direct parse failed — try to extract JSON object from the response
    const extracted = extractJsonObject(cleaned);
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
        console.warn('[AI Pipeline] JSON was embedded in text — extracted successfully');
      } catch (e) {
        console.warn('[AI Pipeline] Failed to parse extracted JSON:', (e as Error).message);
      }
    } else {
      console.warn('[AI Pipeline] No JSON object found in AI response, falling back to markdown');
    }
  }

  if (parsed) {
    // Detect TaxTipData format
    if (parsed.tips && parsed.regime) {
      const taxData = parsed as unknown as TaxTipData;
      const { sections, content } = taxTipToSections(taxData);
      return { sections, content, structuredData: parsed };
    }

    // Detect SpendingAnalysisData format
    if (parsed.healthScore !== undefined && parsed.topCategories) {
      const spendingData = parsed as unknown as SpendingAnalysisData;
      const { sections, content } = spendingToSections(spendingData);
      return { sections, content, structuredData: parsed };
    }

    // Detect MonthlyBudgetData format
    if (parsed.needs && parsed.wants && parsed.savingsInvestments) {
      const budgetData = parsed as unknown as MonthlyBudgetData;
      const { sections, content } = monthlyBudgetToSections(budgetData);
      return { sections, content, structuredData: parsed };
    }

    // Detect WeeklyBudgetData format
    if (parsed.weeklyTarget !== undefined && parsed.dailyLimit !== undefined) {
      const weeklyData = parsed as unknown as WeeklyBudgetData;
      const { sections, content } = weeklyBudgetToSections(weeklyData);
      return { sections, content, structuredData: parsed };
    }

    // Detect InvestmentInsightsData format
    if (parsed.portfolioValue !== undefined && parsed.diversification) {
      const investData = parsed as unknown as InvestmentInsightsData;
      const { sections, content } = investmentToSections(investData);
      return { sections, content, structuredData: parsed };
    }

    // Detect PlannerRecommendationData format
    if (parsed.planScore !== undefined && parsed.allocationReview) {
      const plannerData = parsed as unknown as PlannerRecommendationData;
      const { sections, content } = plannerToSections(plannerData);
      return { sections, content, structuredData: parsed };
    }

    // Generic sections format (legacy fallback)
    if (parsed.sections && Array.isArray(parsed.sections)) {
      const sections: InsightSection[] = (parsed.sections as Record<string, unknown>[])
        .filter((s) => s.id && s.title && s.type)
        .map((s) => ({
          id: String(s.id),
          title: String(s.title),
          type: String(s.type) as InsightSection['type'],
          text: s.text ? String(s.text) : undefined,
          items: Array.isArray(s.items) ? s.items.map(String) : undefined,
          highlight: s.highlight ? String(s.highlight) : undefined,
          severity: ['positive', 'warning', 'critical', 'neutral'].includes(String(s.severity || ''))
            ? (String(s.severity) as InsightSection['severity'])
            : undefined,
        }));

      return { sections, content: sectionsToMarkdown(sections) };
    }

    console.warn('[AI Pipeline] Parsed JSON but could not detect any known format');
  }

  return { content: raw };
}

// Stage 5: Persist and prune
async function persistAnalysis(
  userId: string,
  type: AiInsightType,
  content: string,
  dataPoints: number,
  sections?: InsightSection[],
  searchContext?: { queries: string[]; snippetCount: number },
  structuredData?: Record<string, unknown>
): Promise<void> {
  const db = await getMongoDb();
  const now = new Date().toISOString();

  await db.collection('ai_analyses').insertOne({
    userId,
    type,
    content,
    sections: sections || null,
    structuredData: structuredData || null,
    generatedAt: now,
    dataPoints,
    searchContext: searchContext || null,
    createdAt: now,
  });

  // Prune: keep only last MAX_ANALYSES_PER_TYPE per type per user
  const allDocs = await db
    .collection('ai_analyses')
    .find({ userId, type })
    .sort({ generatedAt: -1 })
    .toArray();

  if (allDocs.length > MAX_ANALYSES_PER_TYPE) {
    const toDelete = allDocs.slice(MAX_ANALYSES_PER_TYPE).map((d) => d._id);
    await db.collection('ai_analyses').deleteMany({ _id: { $in: toDelete } });
  }
}

export async function runAiPipeline(
  userId: string,
  type: AiInsightType,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const { force = false, includeSearch = true } = options;

  // Check cache first (unless force regenerate)
  if (!force) {
    const cached = await getCachedAnalysis(userId, type);
    if (cached && !cached.stale) {
      return {
        content: cached.content,
        sections: cached.sections,
        structuredData: cached.structuredData,
        generatedAt: cached.generatedAt,
        dataPoints: cached.dataPoints,
        fromCache: true,
        stale: false,
        searchContext: cached.searchContext,
      };
    }
  }

  // Stage 1: Collect
  const ctx = await collectUserData(userId, type);

  if (ctx.transactionCount === 0 && type !== 'investment_insights' && type !== 'tax_optimization' && type !== 'planner_recommendation') {
    throw new Error('No transaction data available. Please sync first.');
  }

  // Stage 2: Enrich (search) — only for investment_insights
  let searchContext: { queries: string[]; snippetCount: number } | undefined;
  if (type === 'investment_insights' && includeSearch) {
    const searchResult = await searchMarketContext(ctx.stockSymbols, ctx.mutualFundNames);
    if (searchResult.context) {
      ctx.marketContext = searchResult.context;
      searchContext = { queries: searchResult.queries, snippetCount: searchResult.snippetCount };
    }
  }

  // Stage 3: Prompt
  const systemPrompt = getSystemPrompt(type);
  const userMessage = buildUserMessage(type, ctx);

  // Stage 4: Generate
  const rawContent = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    { maxTokens: 4000 }
  );

  // Parse structured JSON (falls back to markdown if AI didn't return JSON)
  const { sections, content, structuredData } = parseAiResponse(rawContent);

  // Stage 5: Persist
  await persistAnalysis(userId, type, content, ctx.transactionCount, sections, searchContext, structuredData);

  return {
    content,
    sections,
    structuredData,
    generatedAt: new Date().toISOString(),
    dataPoints: ctx.transactionCount,
    fromCache: false,
    stale: false,
    searchContext,
  };
}
