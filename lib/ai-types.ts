export type AiInsightType = 'spending_analysis' | 'monthly_budget' | 'weekly_budget' | 'investment_insights' | 'tax_optimization' | 'planner_recommendation';

/* ─── Tax optimization structured data ─── */

export interface TaxTipData {
  totalSavingPotential: number;
  regime: {
    recommended: 'old' | 'new';
    oldTax: number;
    newTax: number;
    savings: number;
    effectiveRate: number;
  };
  deductionUtilization: Array<{
    section: string;
    label: string;
    used: number;
    limit: number;
  }>;
  tips: Array<{
    title: string;
    description: string;
    savingAmount: number;
    section: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  subscriptions?: Array<{
    name: string;
    domain: string;
    monthlyCost: number;
    annualCost: number;
    suggestion: string;
  }>;
}

/* ─── Spending analysis structured data ─── */

export interface SpendingAnalysisData {
  healthScore: number;
  summary: {
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
    verdict: string;
  };
  topCategories: Array<{
    name: string;
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
    suggestion?: string;
  }>;
  actionItems: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    savingAmount: number;
    category: string;
  }>;
  alerts: Array<{
    type: 'warning' | 'critical' | 'positive';
    title: string;
    message: string;
  }>;
  keyInsight: string;
}

/* ─── Monthly budget structured data ─── */

export interface MonthlyBudgetData {
  totalIncome: number;
  totalBudget: number;
  surplus: number;
  needs: {
    total: number;
    percentage: number;
    categories: Array<{
      name: string;
      budgeted: number;
      actual: number;
      status: 'on_track' | 'over' | 'under';
    }>;
  };
  wants: {
    total: number;
    percentage: number;
    categories: Array<{
      name: string;
      budgeted: number;
      actual: number;
      status: 'on_track' | 'over' | 'under';
    }>;
  };
  savingsInvestments: {
    total: number;
    percentage: number;
    categories: Array<{
      name: string;
      budgeted: number;
      actual: number;
      status: 'on_track' | 'over' | 'under';
    }>;
  };
  savingsOpportunities: Array<{
    title: string;
    description: string;
    amount: number;
  }>;
  warnings: Array<{
    title: string;
    message: string;
    severity: 'warning' | 'critical';
  }>;
  positiveNote: string;
}

/* ─── Weekly budget structured data ─── */

export interface WeeklyBudgetData {
  weeklyTarget: number;
  daysRemaining: number;
  spent: number;
  remaining: number;
  dailyLimit: number;
  onTrack: boolean;
  categories: Array<{
    name: string;
    weeklyBudget: number;
    spent: number;
    remaining: number;
    status: 'on_track' | 'over' | 'under';
  }>;
  quickWins: Array<{
    title: string;
    description: string;
    savingAmount: number;
  }>;
  warnings: Array<{
    title: string;
    message: string;
  }>;
  weeklyRule: string;
}

/* ─── Investment insights structured data ─── */

export interface InvestmentInsightsData {
  portfolioValue: number;
  totalInvested: number;
  totalReturns: number;
  returnPercentage: number;
  xirr: number | null;
  verdict: string;
  stocks: Array<{
    symbol: string;
    name: string;
    currentValue: number;
    invested: number;
    returns: number;
    returnPercentage: number;
    recommendation: string;
  }>;
  mutualFunds: Array<{
    name: string;
    currentValue: number;
    invested: number;
    returns: number;
    returnPercentage: number;
    sipAmount: number;
    recommendation: string;
  }>;
  diversification: {
    assessment: string;
    severity: 'positive' | 'warning' | 'critical';
    suggestions: string[];
  };
  actionItems: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  marketContext: string;
  goalAlignment: string;
}

/* ─── Planner recommendation structured data ─── */

export interface PlannerRecommendationData {
  planScore: number;
  summary: string;
  allocationReview: {
    needsPct: number;
    wantsPct: number;
    investmentsPct: number;
    savingsPct: number;
    verdict: string;
    severity: 'positive' | 'warning' | 'critical';
  };
  planVsActual: Array<{
    category: string;
    planned: number;
    actual: number;
    deviation: number;
    status: 'on_track' | 'over' | 'under';
  }>;
  goalFeasibility: Array<{
    goalName: string;
    targetAmount: number;
    currentAmount: number;
    monthlySaving: number;
    monthsToGoal: number;
    feasible: boolean;
    suggestion: string;
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    category: string;
  }>;
  keyTakeaway: string;
}

/* ─── Structured insight sections ─── */

export type InsightSectionType = 'summary' | 'list' | 'numbered_list' | 'highlight';

export interface InsightSection {
  id: string;
  title: string;
  type: InsightSectionType;
  /** For 'summary' — a paragraph of text */
  text?: string;
  /** For 'list' / 'numbered_list' */
  items?: string[];
  /** For 'highlight' — a single key sentence */
  highlight?: string;
  /** Optional severity for visual styling */
  severity?: 'positive' | 'warning' | 'critical' | 'neutral';
}

export interface AiAnalysisDoc {
  _id?: string;
  userId: string;
  type: AiInsightType;
  /** Legacy markdown (kept for backward compat) */
  content: string;
  /** Structured sections — preferred for rendering */
  sections?: InsightSection[];
  /** Type-specific structured data (TaxTipData, SpendingAnalysisData, etc.) */
  structuredData?: Record<string, unknown>;
  generatedAt: string;
  dataPoints: number;
  searchContext?: { queries: string[]; snippetCount: number };
  createdAt: string;
}

export interface PipelineContext {
  userId: string;
  financialContext: string;
  investmentContext: string;
  nwiContext: string;
  healthContext: string;
  goalsContext: string;
  currentMonthContext: string;
  transactionCount: number;
  marketContext: string;
  stockSymbols: string[];
  mutualFundNames: string[];
  taxContext?: string;
  plannerContext?: string;
}

export interface PipelineOptions {
  force?: boolean;
  includeSearch?: boolean;
}

export interface PipelineResult {
  content: string;
  sections?: InsightSection[];
  structuredData?: Record<string, unknown>;
  generatedAt: string;
  dataPoints: number;
  fromCache: boolean;
  stale: boolean;
  searchContext?: { queries: string[]; snippetCount: number };
}
