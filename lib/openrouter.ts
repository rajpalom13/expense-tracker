/**
 * OpenRouter API client for AI-powered financial insights
 * Uses OpenRouter to access Claude and other models for spending analysis
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Send a chat completion request to OpenRouter
 */
export async function chatCompletion(
  messages: OpenRouterMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const model = options?.model || 'anthropic/claude-sonnet-4.5';
  const maxTokens = options?.maxTokens || 2048;
  const temperature = options?.temperature ?? 0.3;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://finance-tracker.local',
      'X-Title': 'Finance Tracker AI',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenRouter');
  }

  return data.choices[0].message.content;
}

/**
 * Build a financial context summary from transaction data
 * Keeps token count manageable by summarizing instead of sending raw data
 */
export function buildFinancialContext(params: {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  topCategories: { category: string; amount: number; percentage: number }[];
  monthlyTrends: { month: string; income: number; expenses: number; savings: number }[];
  dailyAverage: number;
  recurringExpenses: number;
  oneTimeExpenses?: { description: string; amount: number }[];
  accountBalance?: number;
  openingBalance?: number;
}): string {
  const lines: string[] = [
    `## Financial Overview (INR)`,
    `- Total Income: ${formatINR(params.totalIncome)}`,
    `- Total Expenses: ${formatINR(params.totalExpenses)}`,
    `- Net Savings: ${formatINR(params.totalIncome - params.totalExpenses)}`,
    `- Savings Rate: ${params.savingsRate.toFixed(1)}%`,
    `- Daily Average Spend: ${formatINR(params.dailyAverage)}`,
    `- Recurring Expenses: ${formatINR(params.recurringExpenses)}`,
  ];

  if (params.accountBalance !== undefined) {
    lines.push(`- Current Balance: ${formatINR(params.accountBalance)}`);
  }
  if (params.openingBalance !== undefined) {
    lines.push(`- Opening Balance: ${formatINR(params.openingBalance)}`);
  }

  lines.push('', '## Top Expense Categories');
  for (const cat of params.topCategories.slice(0, 8)) {
    lines.push(`- ${cat.category}: ${formatINR(cat.amount)} (${cat.percentage.toFixed(1)}%)`);
  }

  if (params.oneTimeExpenses && params.oneTimeExpenses.length > 0) {
    lines.push('', '## Large One-Time Expenses');
    for (const exp of params.oneTimeExpenses) {
      lines.push(`- ${exp.description}: ${formatINR(exp.amount)}`);
    }
  }

  lines.push('', '## Monthly Trends (recent)');
  for (const m of params.monthlyTrends.slice(-6)) {
    lines.push(
      `- ${m.month}: Income ${formatINR(m.income)}, Expenses ${formatINR(m.expenses)}, Savings ${formatINR(m.savings)}`
    );
  }

  return lines.join('\n');
}

/**
 * Build SIP/investment context for insights
 */
export function buildInvestmentContext(params: {
  sips: { name: string; monthly: number; provider: string; status: string }[];
  stocks: { symbol: string; shares: number; avgCost: number; currentPrice?: number }[];
  mutualFunds: { name: string; invested: number; current: number; returns: number }[];
  totalInvested: number;
  totalCurrentValue: number;
}): string {
  const lines: string[] = [
    '## Investment Portfolio (INR)',
    `- Total Invested: ${formatINR(params.totalInvested)}`,
    `- Current Value: ${formatINR(params.totalCurrentValue)}`,
    `- Total Returns: ${formatINR(params.totalCurrentValue - params.totalInvested)} (${params.totalInvested > 0 ? (((params.totalCurrentValue - params.totalInvested) / params.totalInvested) * 100).toFixed(1) : 0}%)`,
  ];

  if (params.sips.length > 0) {
    lines.push('', '## Active SIPs');
    for (const sip of params.sips) {
      lines.push(`- ${sip.name} (${sip.provider}): ${formatINR(sip.monthly)}/month [${sip.status}]`);
    }
  }

  if (params.stocks.length > 0) {
    lines.push('', '## Stock Holdings');
    for (const stock of params.stocks) {
      const currentVal = stock.currentPrice ? stock.currentPrice * stock.shares : undefined;
      lines.push(
        `- ${stock.symbol}: ${stock.shares} shares @ avg ${formatINR(stock.avgCost)}${currentVal ? `, current ${formatINR(currentVal)}` : ''}`
      );
    }
  }

  if (params.mutualFunds.length > 0) {
    lines.push('', '## Mutual Funds');
    for (const mf of params.mutualFunds) {
      lines.push(
        `- ${mf.name}: Invested ${formatINR(mf.invested)}, Current ${formatINR(mf.current)}, Returns ${formatINR(mf.returns)}`
      );
    }
  }

  return lines.join('\n');
}

function formatINR(amount: number): string {
  return `Rs.${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
