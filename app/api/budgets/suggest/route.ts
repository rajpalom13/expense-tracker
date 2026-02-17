/**
 * Budget Suggestions API
 * Analyzes the last 3 months of spending and suggests realistic budgets.
 *
 * GET /api/budgets/suggest - Returns per-category suggestions based on spending history.
 *
 * Logic:
 * - If avg3Month > currentBudget * 2: suggest avg3Month * 0.8 (aim for 20% reduction)
 * - If avg3Month > currentBudget:     suggest avg3Month * 0.9 (aim for 10% reduction)
 * - If avg3Month <= currentBudget:    keep current budget (it's working)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, corsHeaders, handleOptions } from '@/lib/middleware';
import { getMongoDb } from '@/lib/mongodb';
import { TransactionType } from '@/lib/types';

const CATEGORIES_COLLECTION = 'budget_categories';
const TRANSACTIONS_COLLECTION = 'transactions';

export async function OPTIONS() {
  return handleOptions();
}

interface CategorySuggestion {
  currentBudget: number;
  avg3Month: number;
  suggestedBudget: number;
  reasoning: string;
}

/**
 * Build a reverse lookup: transaction category -> budget category name.
 * Similar to buildReverseCategoryMap in budget-mapping.ts but works with
 * raw MongoDB docs to avoid importing client-only code.
 */
function buildReverseMap(
  docs: Array<{ name: string; transactionCategories: string[] }>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const doc of docs) {
    for (const cat of doc.transactionCategories) {
      map[cat] = doc.name;
    }
  }
  return map;
}

/**
 * GET /api/budgets/suggest
 * Fetch spending from the last 3 months, compare against current budgets,
 * and return per-category suggestions.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();

      // 1. Fetch budget categories for this user
      const categoryDocs = await db
        .collection(CATEGORIES_COLLECTION)
        .find({ userId: user.userId })
        .toArray();

      if (categoryDocs.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No budget categories found' },
          { status: 404, headers: corsHeaders() }
        );
      }

      // Build current budgets and reverse category map
      const currentBudgets: Record<string, number> = {};
      const budgetCategoryNames = new Set<string>();
      for (const doc of categoryDocs) {
        currentBudgets[doc.name] = doc.budgetAmount;
        budgetCategoryNames.add(doc.name);
      }

      const reverseMap = buildReverseMap(
        categoryDocs as unknown as Array<{ name: string; transactionCategories: string[] }>
      );

      // 2. Fetch transactions from the last 3 months
      const now = new Date();
      const threeMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 3,
        1
      );

      const txnDocs = await db
        .collection(TRANSACTIONS_COLLECTION)
        .find({
          userId: user.userId,
          type: TransactionType.EXPENSE,
          date: { $gte: threeMonthsAgo.toISOString() },
        })
        .toArray();

      // 3. Group spending by budget category per month
      // monthKey -> budgetCategory -> totalSpent
      const monthlySpending: Record<string, Record<string, number>> = {};

      for (const doc of txnDocs) {
        const txnDate = new Date(doc.date as string);
        const monthKey = `${txnDate.getFullYear()}-${txnDate.getMonth() + 1}`;
        const rawCategory = doc.category as string;
        const amount = Math.abs(Number(doc.amount) || 0);

        // Map transaction category to budget category
        let budgetCategory: string;
        if (budgetCategoryNames.has(rawCategory)) {
          budgetCategory = rawCategory;
        } else if (reverseMap[rawCategory]) {
          budgetCategory = reverseMap[rawCategory];
        } else {
          // Unmapped categories go to "Others" if it exists
          budgetCategory = budgetCategoryNames.has('Others')
            ? 'Others'
            : rawCategory;
        }

        // Only count spending for categories that have a budget
        if (!budgetCategoryNames.has(budgetCategory)) continue;

        if (!monthlySpending[monthKey]) {
          monthlySpending[monthKey] = {};
        }
        monthlySpending[monthKey][budgetCategory] =
          (monthlySpending[monthKey][budgetCategory] || 0) + amount;
      }

      // 4. Calculate 3-month averages per category
      const monthCount = Math.max(Object.keys(monthlySpending).length, 1);
      const categoryTotals: Record<string, number> = {};

      for (const monthData of Object.values(monthlySpending)) {
        for (const [category, amount] of Object.entries(monthData)) {
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        }
      }

      // 5. Generate suggestions
      const suggestions: Record<string, CategorySuggestion> = {};
      let totalCurrent = 0;
      let totalSuggested = 0;

      for (const categoryName of budgetCategoryNames) {
        const current = currentBudgets[categoryName] || 0;
        const avg3Month = Math.round(
          (categoryTotals[categoryName] || 0) / monthCount
        );

        let suggestedBudget: number;
        let reasoning: string;

        if (avg3Month > current * 2) {
          // Spending is wildly over budget -- suggest 20% reduction from actual
          suggestedBudget = Math.round(avg3Month * 0.8);
          reasoning = `Your 3-month average is ${formatINR(avg3Month)}, which is ${Math.round((avg3Month / current) * 100)}% of your current budget. We suggest ${formatINR(suggestedBudget)} as a realistic target with a 20% reduction from actual spending.`;
        } else if (avg3Month > current) {
          // Spending is over budget -- suggest 10% reduction from actual
          suggestedBudget = Math.round(avg3Month * 0.9);
          reasoning = `Your 3-month average of ${formatINR(avg3Month)} exceeds your budget. We suggest ${formatINR(suggestedBudget)} as a target with a 10% reduction.`;
        } else {
          // Spending is within budget -- keep current
          suggestedBudget = current;
          reasoning =
            current > 0
              ? `Your spending of ${formatINR(avg3Month)}/mo is within budget. No change needed.`
              : 'No spending recorded and no budget set.';
        }

        suggestions[categoryName] = {
          currentBudget: current,
          avg3Month,
          suggestedBudget,
          reasoning,
        };

        totalCurrent += current;
        totalSuggested += suggestedBudget;
      }

      return NextResponse.json(
        {
          success: true,
          suggestions,
          totalCurrent,
          totalSuggested,
          monthsAnalyzed: monthCount,
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in GET /api/budgets/suggest:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to generate budget suggestions' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/** Simple INR formatter for server-side reasoning strings */
function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
