/**
 * Budget API endpoints
 * Handles budget retrieval and updates using MongoDB.
 *
 * GET  - Returns merged budgets (from budget_categories collection).
 * POST - Bulk-update all budget amounts (writes into budget_categories docs).
 * PUT  - Update a single category's budget amount.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, corsHeaders, handleOptions } from '@/lib/middleware';
import { getMongoDb } from '@/lib/mongodb';
import { buildSeedDocs, DEFAULT_BUDGETS } from '@/lib/budget-mapping';

const COLLECTION = 'budget_categories';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/budgets
 * Retrieve budgets for the authenticated user.
 * Derives the budget record from budget_categories collection.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      let docs = await col.find({ userId: user.userId }).toArray();

      // Seed defaults on first access
      if (docs.length === 0) {
        const seeds = buildSeedDocs(user.userId);
        await col.insertMany(seeds);
        docs = await col.find({ userId: user.userId }).toArray();
      }

      const budgets: Record<string, number> = {};
      let latestUpdatedAt: string | null = null;

      for (const doc of docs) {
        budgets[doc.name] = doc.budgetAmount;
        if (!latestUpdatedAt || doc.updatedAt > latestUpdatedAt) {
          latestUpdatedAt = doc.updatedAt;
        }
      }

      return NextResponse.json(
        {
          success: true,
          budgets,
          updatedAt: latestUpdatedAt,
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in GET /api/budgets:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load budgets' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * POST /api/budgets
 * Bulk-update all budget amounts for the authenticated user.
 * Body: { budgets: Record<string, number> }
 */
export async function POST(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const { budgets } = body;

      if (!budgets || typeof budgets !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Invalid budgets data' },
          { status: 400, headers: corsHeaders() }
        );
      }

      for (const [category, amount] of Object.entries(budgets)) {
        if (typeof amount !== 'number' || amount < 0) {
          return NextResponse.json(
            { success: false, error: `Invalid budget amount for ${category}` },
            { status: 400, headers: corsHeaders() }
          );
        }
      }

      const updatedAt = new Date().toISOString();
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      // Update each category doc's budgetAmount
      const ops = Object.entries(budgets).map(([name, amount]) =>
        col.updateOne(
          { userId: user.userId, name },
          { $set: { budgetAmount: amount, updatedAt } },
          { upsert: false }
        )
      );
      await Promise.all(ops);

      return NextResponse.json(
        {
          success: true,
          message: 'Budgets updated successfully',
          budgets,
          updatedAt,
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in POST /api/budgets:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update budgets' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * PUT /api/budgets
 * Update a single budget category's amount.
 * Body: { category, amount }
 */
export async function PUT(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const { category, amount } = body;

      if (!category || typeof category !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Invalid category' },
          { status: 400, headers: corsHeaders() }
        );
      }

      if (typeof amount !== 'number' || amount < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid amount' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const updatedAt = new Date().toISOString();
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const result = await col.updateOne(
        { userId: user.userId, name: category },
        { $set: { budgetAmount: amount, updatedAt } }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { success: false, error: `Category "${category}" not found` },
          { status: 404, headers: corsHeaders() }
        );
      }

      // Return full budgets for client sync
      const docs = await col.find({ userId: user.userId }).toArray();
      const updatedBudgets: Record<string, number> = {};
      for (const doc of docs) {
        updatedBudgets[doc.name] = doc.budgetAmount;
      }

      return NextResponse.json(
        {
          success: true,
          message: `Budget for ${category} updated successfully`,
          budgets: updatedBudgets,
          updatedAt,
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in PUT /api/budgets:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update budget' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}
