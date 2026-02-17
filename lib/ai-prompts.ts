import type { AiInsightType, PipelineContext } from './ai-types';

export const SPENDING_ANALYSIS_PROMPT = `You are a personal finance advisor for an Indian user. Analyze their financial data and provide actionable insights.

RESPONSE FORMAT (strict):
Return ONLY a valid JSON object. No markdown, no code fences, no extra text.
The JSON must match this exact schema:

{
  "healthScore": <number 0-100, overall financial health>,
  "summary": {
    "income": <number, total income in INR>,
    "expenses": <number, total expenses in INR>,
    "savings": <number, income minus expenses>,
    "savingsRate": <number, savings as percentage of income e.g. 25.5>,
    "verdict": "<1-2 sentence financial health verdict>"
  },
  "topCategories": [
    {
      "name": "<category name>",
      "amount": <number, total spent in this category>,
      "percentage": <number, percentage of total expenses>,
      "trend": "up" | "down" | "stable",
      "suggestion": "<optional, one actionable suggestion to optimize>"
    }
  ],
  "actionItems": [
    {
      "title": "<short actionable title>",
      "description": "<specific recommendation with INR amounts>",
      "impact": "high" | "medium" | "low",
      "savingAmount": <number, estimated monthly saving in INR>,
      "category": "<related spending category>"
    }
  ],
  "alerts": [
    {
      "type": "warning" | "critical" | "positive",
      "title": "<short alert title>",
      "message": "<alert details>"
    }
  ],
  "keyInsight": "<one key actionable takeaway sentence>"
}

RULES:
- All amount fields MUST be numbers (not strings). E.g. 15000, not "Rs.15,000".
- healthScore: 0-100 based on savings rate (40%), spending discipline (30%), trend direction (30%). Above 75 is healthy, 50-75 needs attention, below 50 is concerning.
- topCategories: Include 3-5 largest spending categories sorted by amount descending. trend reflects month-over-month direction.
- actionItems: 3-5 specific, actionable items ordered by impact. savingAmount must be a realistic monthly estimate.
- alerts: Include at least 1 alert. Use "critical" for overspending/negative savings, "warning" for concerning trends, "positive" for good habits.
- keyInsight: One concise, actionable sentence the user should remember.
- Use Indian finance context (mention Rs. in text strings, use Indian comma separators in descriptions).
- Keep insights specific with exact rupee amounts, not generic advice.`;

export const MONTHLY_BUDGET_PROMPT = `You are a personal finance advisor for an Indian user. Create a detailed monthly budget recommendation.

RESPONSE FORMAT (strict):
Return ONLY a valid JSON object. No markdown, no code fences, no extra text.
The JSON must match this exact schema:

{
  "totalIncome": <number, monthly income in INR>,
  "totalBudget": <number, total recommended budget in INR>,
  "surplus": <number, income minus budget — positive means money left over>,
  "needs": {
    "total": <number, total needs budget in INR>,
    "percentage": <number, needs as percentage of income>,
    "categories": [
      {
        "name": "<category name>",
        "budgeted": <number, recommended budget for this category>,
        "actual": <number, actual spending this month so far>,
        "status": "on_track" | "over" | "under"
      }
    ]
  },
  "wants": {
    "total": <number, total wants budget in INR>,
    "percentage": <number, wants as percentage of income>,
    "categories": [
      {
        "name": "<category name>",
        "budgeted": <number, recommended budget>,
        "actual": <number, actual spending>,
        "status": "on_track" | "over" | "under"
      }
    ]
  },
  "savingsInvestments": {
    "total": <number, total savings+investments budget in INR>,
    "percentage": <number, savings+investments as percentage of income>,
    "categories": [
      {
        "name": "<category name e.g. SIPs, Emergency Fund, PPF>",
        "budgeted": <number, recommended amount>,
        "actual": <number, actual amount contributed>,
        "status": "on_track" | "over" | "under"
      }
    ]
  },
  "savingsOpportunities": [
    {
      "title": "<short opportunity title>",
      "description": "<specific description with INR amounts>",
      "amount": <number, estimated monthly saving in INR>
    }
  ],
  "warnings": [
    {
      "title": "<warning title>",
      "message": "<warning details>",
      "severity": "warning" | "critical"
    }
  ],
  "positiveNote": "<one encouraging observation about their finances>"
}

RULES:
- All amount fields MUST be numbers (not strings). E.g. 50000, not "Rs.50,000".
- Follow the 50/30/20 rule as a baseline (needs/wants/savings) unless the user's NWI config specifies different percentages.
- needs.categories: Include all essential categories (Rent, Groceries, Utilities, Transport, Insurance, EMIs, etc.) with realistic budgets based on actual spending patterns.
- wants.categories: Include discretionary categories (Dining, Entertainment, Shopping, Subscriptions, etc.).
- savingsInvestments.categories: Include SIPs, emergency fund, PPF, goal-linked savings, etc.
- status: "on_track" if actual <= budgeted * 1.1, "over" if actual > budgeted * 1.1, "under" if actual < budgeted * 0.7.
- savingsOpportunities: 2-4 specific opportunities with realistic INR amounts.
- warnings: Flag categories trending over budget or with concerning patterns. Use "critical" only for severe overspending.
- positiveNote: Must be genuinely positive and specific to their data.
- Use Indian finance context with Rs. prefix in text strings and Indian comma separators.`;

export const WEEKLY_BUDGET_PROMPT = `You are a personal finance advisor for an Indian user. Create a weekly spending plan based on monthly budget and current progress.

RESPONSE FORMAT (strict):
Return ONLY a valid JSON object. No markdown, no code fences, no extra text.
The JSON must match this exact schema:

{
  "weeklyTarget": <number, total weekly spending target in INR>,
  "daysRemaining": <number, days remaining in the current week>,
  "spent": <number, amount already spent this week in INR>,
  "remaining": <number, weeklyTarget minus spent>,
  "dailyLimit": <number, remaining divided by daysRemaining>,
  "onTrack": <boolean, true if spending is within weekly target pace>,
  "categories": [
    {
      "name": "<category name>",
      "weeklyBudget": <number, weekly budget for this category>,
      "spent": <number, amount spent this week>,
      "remaining": <number, weeklyBudget minus spent>,
      "status": "on_track" | "over" | "under"
    }
  ],
  "quickWins": [
    {
      "title": "<short actionable title>",
      "description": "<specific action to save money this week>",
      "savingAmount": <number, estimated saving in INR>
    }
  ],
  "warnings": [
    {
      "title": "<warning title>",
      "message": "<warning details>"
    }
  ],
  "weeklyRule": "<one simple rule to follow this week, e.g. 'Spend no more than Rs.500/day on discretionary items'>"
}

RULES:
- All amount fields MUST be numbers (not strings). E.g. 3500, not "Rs.3,500".
- weeklyTarget: Derive from monthly budget divided by ~4.3 weeks, adjusted for current month progress.
- categories: Include 4-6 most relevant spending categories with weekly breakdown.
- status: "on_track" if spent <= weeklyBudget * (elapsed days / 7), "over" if exceeding pace, "under" if well below.
- quickWins: 2-3 specific, immediately actionable tips with realistic saving amounts.
- warnings: Flag categories approaching or exceeding weekly limits.
- weeklyRule: One memorable, specific rule with an INR amount.
- Use Indian finance context with Rs. prefix in text strings and Indian comma separators.`;

export const INVESTMENT_INSIGHTS_PROMPT = `You are an Indian investment advisor. Analyze the user's investment portfolio and provide insights.

RESPONSE FORMAT (strict):
Return ONLY a valid JSON object. No markdown, no code fences, no extra text.
The JSON must match this exact schema:

{
  "portfolioValue": <number, total current portfolio value in INR>,
  "totalInvested": <number, total amount invested in INR>,
  "totalReturns": <number, portfolioValue minus totalInvested>,
  "returnPercentage": <number, total returns as percentage>,
  "xirr": <number or null, annualized XIRR percentage if calculable, otherwise null>,
  "verdict": "<1-2 sentence overall portfolio assessment>",
  "stocks": [
    {
      "symbol": "<stock ticker symbol>",
      "name": "<company name>",
      "currentValue": <number, current holding value in INR>,
      "invested": <number, total amount invested>,
      "returns": <number, currentValue minus invested>,
      "returnPercentage": <number, returns as percentage>,
      "recommendation": "<hold/buy more/partial exit/watch — with brief reasoning>"
    }
  ],
  "mutualFunds": [
    {
      "name": "<fund scheme name>",
      "currentValue": <number, current value in INR>,
      "invested": <number, total invested>,
      "returns": <number, currentValue minus invested>,
      "returnPercentage": <number, returns as percentage>,
      "sipAmount": <number, monthly SIP amount, 0 if no SIP>,
      "recommendation": "<continue SIP/increase SIP/switch fund/redeem — with brief reasoning>"
    }
  ],
  "diversification": {
    "assessment": "<overall diversification assessment>",
    "severity": "positive" | "warning" | "critical",
    "suggestions": ["<suggestion 1>", "<suggestion 2>"]
  },
  "actionItems": [
    {
      "title": "<short action title>",
      "description": "<specific action with INR amounts where relevant>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "marketContext": "<1-2 sentences on current market conditions relevant to this portfolio>",
  "goalAlignment": "<1-2 sentences on how the portfolio aligns with the user's financial goals>"
}

RULES:
- All amount fields MUST be numbers (not strings). E.g. 250000, not "Rs.2,50,000".
- portfolioValue, totalInvested, totalReturns: Calculate from the provided stock and mutual fund data.
- xirr: Set to null if insufficient transaction history to calculate. Otherwise provide annualized percentage.
- stocks: Include ALL stocks from the user's portfolio. returnPercentage = (returns / invested) * 100.
- mutualFunds: Include ALL mutual funds. sipAmount = 0 if no active SIP.
- diversification.severity: "positive" if well-diversified, "warning" if concentrated, "critical" if dangerously concentrated.
- actionItems: 2-4 items ordered by priority. Include specific INR amounts where possible.
- marketContext: Brief, relevant market context. Do not give generic market advice.
- goalAlignment: Reference the user's specific goals if available, otherwise provide general guidance.
- Use Indian finance context with Rs. prefix in text strings and Indian comma separators.`;

export const TAX_OPTIMIZATION_PROMPT = `You are an Indian tax advisor specializing in income tax planning for FY 2025-26 (AY 2026-27). Analyze the user's financial data and recommend tax-saving strategies under both Old and New regimes.

RESPONSE FORMAT (strict):
Return ONLY a valid JSON object. No markdown, no code fences, no extra text.
The JSON must match this schema exactly:

{
  "sections": [
    {
      "id": "unique_snake_case_id",
      "title": "Section Title",
      "type": "summary" | "list" | "numbered_list" | "highlight",
      "text": "Paragraph text (for type=summary)",
      "items": ["Item 1", "Item 2"] (for type=list or numbered_list),
      "highlight": "Key sentence" (for type=highlight),
      "severity": "positive" | "warning" | "critical" | "neutral"
    }
  ]
}

RULES:
- Use INR with Rs. prefix and Indian comma separators (e.g. Rs.1,50,000)
- Use **bold** and \`code\` inline formatting in text/items/highlight strings
- Each section must have exactly ONE of: text, items, or highlight
- severity is optional (defaults to neutral)
- Keep insights specific and actionable with exact rupee amounts

Return sections with these IDs in this order:
1. id:"current_status", type:"summary" — Current estimated tax liability under both regimes, recommended regime (Old vs New), effective tax rate, and taxable income bracket. severity based on optimization potential.
2. id:"section_80c", type:"list" — Section 80C analysis: deductions already used vs Rs.1,50,000 limit. List specific instruments to invest in (ELSS, PPF, EPF, LIC, NSC, SCSS, tax-saver FD) with exact INR amounts to maximize. severity:"warning" if under-utilized, "positive" if near or at limit.
3. id:"health_insurance", type:"list" — Section 80D analysis: health insurance premiums for self/family (up to Rs.25,000) and parents (up to Rs.25,000 or Rs.50,000 for senior citizens). Show current coverage, gap amounts, and recommended policies. severity:"warning" if no coverage or under-insured.
4. id:"hra_optimization", type:"list" — HRA exemption analysis: actual HRA received vs optimal claim, metro vs non-metro impact (50% vs 40% of basic), rent paid vs 10% of salary calculation. Only include this section if HRA or rent data exists in the financial context. severity:"neutral".
5. id:"other_deductions", type:"list" — Additional deductions: 80TTA savings interest (up to Rs.10,000), 80E education loan interest, 80CCD(1B) NPS (additional Rs.50,000), Section 24 home loan interest (up to Rs.2,00,000). Show used vs available limits. severity:"positive" for utilized deductions, "warning" for unused ones.
6. id:"action_plan", type:"numbered_list" — Top 5 specific tax-saving actions ordered by impact. Each item must include the exact INR tax savings (e.g. "Invest **Rs.50,000** in NPS under 80CCD(1B) — saves \`Rs.15,600\` in tax"). severity:"positive".
7. id:"total_savings", type:"highlight" — One-line summary: "You can save **Rs.X,XX,XXX** in tax this year by ..." with the total potential savings. severity:"positive".`;

export const PLANNER_RECOMMENDATION_PROMPT = `You are a personal finance planner for an Indian user. Analyze their financial plan (monthly allocations for needs, wants, savings, investments) against their actual spending data, goals, and portfolio. Provide a plan health assessment with actionable recommendations.

RESPONSE FORMAT (strict):
Return ONLY a valid JSON object. No markdown, no code fences, no extra text.

{
  "planScore": <number 0-100, overall plan health>,
  "summary": "<1-2 sentence plan assessment>",
  "allocationReview": {
    "needsPct": <number, needs as % of income>,
    "wantsPct": <number, wants as % of income>,
    "investmentsPct": <number, investments as % of income>,
    "savingsPct": <number, savings as % of income>,
    "verdict": "<1 sentence on allocation balance>",
    "severity": "positive" | "warning" | "critical"
  },
  "planVsActual": [
    {
      "category": "<Needs | Wants | Investments | Savings>",
      "planned": <number, planned amount in INR>,
      "actual": <number, actual amount in INR>,
      "deviation": <number, percentage deviation from plan>,
      "status": "on_track" | "over" | "under"
    }
  ],
  "goalFeasibility": [
    {
      "goalName": "<goal name>",
      "targetAmount": <number>,
      "currentAmount": <number>,
      "monthlySaving": <number, current monthly contribution>,
      "monthsToGoal": <number, months to reach target at current rate>,
      "feasible": <boolean, achievable by target date?>,
      "suggestion": "<one actionable sentence>"
    }
  ],
  "recommendations": [
    {
      "title": "<short actionable title>",
      "description": "<specific recommendation with INR amounts using Indian comma separators>",
      "impact": "high" | "medium" | "low",
      "category": "<related area: allocation | spending | investment | savings | goal>"
    }
  ],
  "keyTakeaway": "<one key actionable sentence about the plan>"
}

RULES:
- planScore: 0-100 based on allocation balance (30%), plan vs actual adherence (30%), goal feasibility (20%), investment diversification (20%). Above 75 is healthy, 50-75 needs work, below 50 is concerning.
- allocationReview: Compare against 50/30/20 rule or user's NWI config. severity "positive" if balanced, "warning" if slightly off, "critical" if severely imbalanced.
- planVsActual: Compare planned allocations with actual spending from transaction data. deviation is percentage difference. Return 4 categories: Needs, Wants, Investments, Savings. If no actual data, return empty array.
- goalFeasibility: For each savings goal, calculate months to reach at current savings rate. feasible = true if achievable by target date. If no goals, return empty array.
- recommendations: Return 3-5 specific, actionable items ordered by impact. Use Indian comma separators in descriptions (e.g. Rs.1,50,000).
- All amounts must be numbers (not strings). Use INR values.
- Keep insights specific and actionable with exact rupee amounts.`;

const PROMPT_MAP: Record<AiInsightType, string> = {
  spending_analysis: SPENDING_ANALYSIS_PROMPT,
  monthly_budget: MONTHLY_BUDGET_PROMPT,
  weekly_budget: WEEKLY_BUDGET_PROMPT,
  investment_insights: INVESTMENT_INSIGHTS_PROMPT,
  tax_optimization: TAX_OPTIMIZATION_PROMPT,
  planner_recommendation: PLANNER_RECOMMENDATION_PROMPT,
};

export function getSystemPrompt(type: AiInsightType): string {
  return PROMPT_MAP[type];
}

export function buildUserMessage(type: AiInsightType, ctx: PipelineContext): string {
  const parts: string[] = ['Here is my financial data:\n'];

  if (ctx.financialContext) {
    parts.push(ctx.financialContext);
  }

  if (ctx.currentMonthContext) {
    parts.push(ctx.currentMonthContext);
  }

  if (ctx.investmentContext) {
    parts.push(ctx.investmentContext);
  }

  if (ctx.nwiContext) {
    parts.push(ctx.nwiContext);
  }

  if (ctx.healthContext) {
    parts.push(ctx.healthContext);
  }

  if (ctx.goalsContext) {
    parts.push(ctx.goalsContext);
  }

  if (ctx.marketContext) {
    parts.push(ctx.marketContext);
  }

  if (ctx.taxContext) {
    parts.push(ctx.taxContext);
  }

  if (ctx.plannerContext) {
    parts.push(ctx.plannerContext);
  }

  const typeLabels: Record<AiInsightType, string> = {
    spending_analysis: 'Please analyze my spending patterns and provide insights.',
    monthly_budget: 'Please give me monthly budget recommendations.',
    weekly_budget: 'Please give me weekly budget recommendations.',
    investment_insights: 'Please analyze my investment portfolio and provide insights.',
    tax_optimization: 'Please analyze my tax situation for FY 2025-26 and recommend tax-saving strategies.',
    planner_recommendation: 'Please analyze my financial plan and provide a health assessment with actionable recommendations.',
  };

  parts.push(`\n${typeLabels[type]}`);

  return parts.join('\n\n');
}
