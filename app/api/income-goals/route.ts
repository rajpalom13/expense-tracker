/**
 * Income Goals API endpoints
 * CRUD operations for a single income goal per user, with progress calculations
 * from the transactions collection.
 *
 * GET    - Fetch income goal + calculated progress from transactions (current fiscal year)
 * POST   - Create or update (upsert) income goal for the authenticated user
 * DELETE - Delete income goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { corsHeaders, handleOptions, withAuth } from '@/lib/middleware';

const COLLECTION = 'income_goals';
const TRANSACTIONS_COLLECTION = 'transactions';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * Get the current Indian fiscal year boundaries (April 1 to March 31).
 * If today is before April, fiscal year started last calendar year.
 */
function getFiscalYearRange(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr

  // Fiscal year starts April 1
  const fyStartYear = month >= 3 ? year : year - 1;
  const start = new Date(fyStartYear, 3, 1); // April 1
  const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // March 31

  return { start, end };
}

/**
 * Compute income progress from the transactions collection for the current fiscal year.
 * Returns total income, monthly breakdown by source (category), and month-over-month growth.
 */
async function computeIncomeProgress(
  userId: string,
  db: Awaited<ReturnType<typeof getMongoDb>>
) {
  const { start, end } = getFiscalYearRange();

  const col = db.collection(TRANSACTIONS_COLLECTION);

  // Fetch all income transactions in the current fiscal year
  const incomeTxns = await col
    .find({
      userId,
      type: 'income',
      date: { $gte: start, $lte: end },
    })
    .sort({ date: 1 })
    .toArray();

  let totalIncome = 0;

  // Monthly breakdown: { "2026-01": { "Salary": 75000, "Freelance": 20000, ... } }
  const monthlyMap: Record<string, Record<string, number>> = {};
  // Monthly totals for growth calculation
  const monthlyTotals: Record<string, number> = {};

  for (const txn of incomeTxns) {
    const amount = Math.abs(txn.amount || 0);
    if (amount === 0) continue;

    totalIncome += amount;

    // Determine month key
    const txnDate = txn.date instanceof Date ? txn.date : new Date(txn.date);
    const monthKey = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
    const source = txn.category || 'Other';

    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = {};
    monthlyMap[monthKey][source] = (monthlyMap[monthKey][source] || 0) + amount;
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;
  }

  // Build sorted monthly breakdown array
  const sortedMonths = Object.keys(monthlyTotals).sort();
  const monthlyBreakdown = sortedMonths.map((month) => ({
    month,
    total: monthlyTotals[month],
    sources: monthlyMap[month],
  }));

  // Calculate month-over-month growth rate (last 2 months with data)
  let monthOverMonthGrowth: number | null = null;
  if (sortedMonths.length >= 2) {
    const prev = monthlyTotals[sortedMonths[sortedMonths.length - 2]];
    const curr = monthlyTotals[sortedMonths[sortedMonths.length - 1]];
    if (prev > 0) {
      monthOverMonthGrowth = ((curr - prev) / prev) * 100;
    }
  }

  // Collect unique income sources across the fiscal year
  const allSources = new Set<string>();
  for (const sources of Object.values(monthlyMap)) {
    for (const source of Object.keys(sources)) {
      allSources.add(source);
    }
  }

  return {
    totalIncome,
    monthlyBreakdown,
    monthOverMonthGrowth,
    incomeSources: Array.from(allSources),
    fiscalYearStart: start.toISOString(),
    fiscalYearEnd: end.toISOString(),
    monthsWithData: sortedMonths.length,
  };
}

/**
 * GET /api/income-goals
 * Fetch the income goal for the authenticated user, enriched with progress data
 * from transactions in the current fiscal year.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const doc = await col.findOne({ userId: user.userId });

      // Always compute progress (even without a goal, the data is useful)
      const progress = await computeIncomeProgress(user.userId, db);

      if (!doc) {
        return NextResponse.json(
          {
            success: true,
            goal: null,
            progress,
          },
          { headers: corsHeaders() }
        );
      }

      // Compute gap analysis
      const targetAmount = doc.targetAmount || 0;
      const remaining = Math.max(targetAmount - progress.totalIncome, 0);
      const targetDate = new Date(doc.targetDate);
      const now = new Date();
      const msRemaining = targetDate.getTime() - now.getTime();
      const monthsRemaining = Math.max(Math.ceil(msRemaining / (1000 * 60 * 60 * 24 * 30)), 0);
      const monthlyRequired = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;
      const percentComplete = targetAmount > 0
        ? Math.min((progress.totalIncome / targetAmount) * 100, 100)
        : 0;
      const onTrack = remaining <= 0 || (monthsRemaining > 0 && monthlyRequired <= (progress.totalIncome / Math.max(progress.monthsWithData, 1)));

      const goal = {
        id: doc._id.toString(),
        userId: doc.userId,
        targetAmount: doc.targetAmount,
        targetDate: doc.targetDate,
        sources: doc.sources || [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        // Computed fields
        percentComplete,
        remaining,
        monthsRemaining,
        monthlyRequired,
        onTrack,
      };

      return NextResponse.json(
        {
          success: true,
          goal,
          progress,
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in GET /api/income-goals:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load income goal' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * POST /api/income-goals
 * Create or update (upsert) the income goal for the authenticated user.
 * Body: { targetAmount, targetDate, sources? }
 */
export async function POST(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const { targetAmount, targetDate, sources } = body;

      // Validation
      if (typeof targetAmount !== 'number' || targetAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Target amount must be a positive number' },
          { status: 400, headers: corsHeaders() }
        );
      }

      if (!targetDate || isNaN(Date.parse(targetDate))) {
        return NextResponse.json(
          { success: false, error: 'Target date must be a valid ISO date' },
          { status: 400, headers: corsHeaders() }
        );
      }

      // Validate sources array if provided
      let validatedSources: { name: string; expected: number; frequency: string }[] = [];
      if (Array.isArray(sources)) {
        validatedSources = sources
          .filter(
            (s: unknown) =>
              typeof s === 'object' &&
              s !== null &&
              typeof (s as Record<string, unknown>).name === 'string' &&
              typeof (s as Record<string, unknown>).expected === 'number'
          )
          .map((s: Record<string, unknown>) => ({
            name: String(s.name).trim(),
            expected: Number(s.expected),
            frequency: typeof s.frequency === 'string' ? s.frequency : 'monthly',
          }));
      }

      const now = new Date().toISOString();

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const result = await col.findOneAndUpdate(
        { userId: user.userId },
        {
          $set: {
            targetAmount,
            targetDate,
            sources: validatedSources,
            updatedAt: now,
          },
          $setOnInsert: {
            userId: user.userId,
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Failed to save income goal' },
          { status: 500, headers: corsHeaders() }
        );
      }

      return NextResponse.json(
        {
          success: true,
          goal: {
            id: result._id.toString(),
            userId: result.userId,
            targetAmount: result.targetAmount,
            targetDate: result.targetDate,
            sources: result.sources || [],
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
          },
        },
        { status: 200, headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in POST /api/income-goals:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save income goal' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * DELETE /api/income-goals
 * Delete the income goal for the authenticated user.
 */
export async function DELETE(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const result = await col.deleteOne({ userId: user.userId });

      return NextResponse.json(
        { success: true, deletedCount: result.deletedCount },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in DELETE /api/income-goals:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete income goal' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}
