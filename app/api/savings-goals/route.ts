/**
 * Savings Goals API endpoints
 * CRUD operations for user savings goals with progress calculations.
 *
 * GET    - List all goals with computed progress
 * POST   - Create a new savings goal
 * PUT    - Update an existing goal (or increment currentAmount via addAmount)
 * DELETE - Delete a goal by query param ?id=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { corsHeaders, handleOptions, withAuth } from '@/lib/middleware';
import { calculateGoalProgress } from '@/lib/savings-goals';
import type { SavingsGoalConfig } from '@/lib/types';

const COLLECTION = 'savings_goals';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/savings-goals
 * Retrieve all savings goals for the authenticated user, enriched with progress data.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const docs = await col.find({ userId: user.userId }).toArray();

      const goals = docs.map((doc) => {
        const goal: SavingsGoalConfig = {
          id: doc._id.toString(),
          userId: doc.userId,
          name: doc.name,
          targetAmount: doc.targetAmount,
          currentAmount: doc.currentAmount,
          targetDate: doc.targetDate,
          monthlyContribution: doc.monthlyContribution,
          autoTrack: doc.autoTrack,
          category: doc.category,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
        return calculateGoalProgress(goal);
      });

      return NextResponse.json(
        { success: true, goals },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in GET /api/savings-goals:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load savings goals' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * POST /api/savings-goals
 * Create a new savings goal.
 * Body: { name, targetAmount, targetDate, monthlyContribution?, currentAmount?, autoTrack?, category? }
 */
export async function POST(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const {
        name,
        targetAmount,
        targetDate,
        monthlyContribution,
        currentAmount,
        autoTrack,
        category,
      } = body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Name is required' },
          { status: 400, headers: corsHeaders() }
        );
      }

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

      const now = new Date().toISOString();

      const doc = {
        userId: user.userId,
        name: name.trim(),
        targetAmount,
        currentAmount:
          typeof currentAmount === 'number' && currentAmount >= 0
            ? currentAmount
            : 0,
        targetDate,
        monthlyContribution:
          typeof monthlyContribution === 'number' && monthlyContribution >= 0
            ? monthlyContribution
            : 0,
        autoTrack: typeof autoTrack === 'boolean' ? autoTrack : false,
        ...(category && typeof category === 'string'
          ? { category: category.trim() }
          : {}),
        createdAt: now,
        updatedAt: now,
      };

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);
      const result = await col.insertOne(doc);

      return NextResponse.json(
        {
          success: true,
          goal: { ...doc, id: result.insertedId.toString() },
        },
        { status: 201, headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in POST /api/savings-goals:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create savings goal' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * PUT /api/savings-goals
 * Update an existing savings goal.
 * Body: { id, ...fields }
 * If `addAmount` (number) is provided, currentAmount is incremented instead of replaced.
 */
export async function PUT(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const { id, addAmount, ...fields } = body;

      if (!id || typeof id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Goal id is required' },
          { status: 400, headers: corsHeaders() }
        );
      }

      let objectId: ObjectId;
      try {
        objectId = new ObjectId(id);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid goal id' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateOps: Record<string, any> = {};

      // Build $set from allowed fields
      const allowedFields = [
        'name',
        'targetAmount',
        'currentAmount',
        'targetDate',
        'monthlyContribution',
        'autoTrack',
        'category',
      ];

      const setFields: Record<string, unknown> = { updatedAt: now };
      for (const key of allowedFields) {
        if (fields[key] !== undefined) {
          setFields[key] = fields[key];
        }
      }
      updateOps.$set = setFields;

      // If addAmount is provided, increment currentAmount instead of setting it
      if (typeof addAmount === 'number' && addAmount !== 0) {
        updateOps.$inc = { currentAmount: addAmount };
        // Remove currentAmount from $set to avoid conflict
        delete setFields.currentAmount;
      }

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const result = await col.findOneAndUpdate(
        { _id: objectId, userId: user.userId },
        updateOps,
        { returnDocument: 'after' }
      );

      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Savings goal not found' },
          { status: 404, headers: corsHeaders() }
        );
      }

      const goal: SavingsGoalConfig = {
        id: result._id.toString(),
        userId: result.userId,
        name: result.name,
        targetAmount: result.targetAmount,
        currentAmount: result.currentAmount,
        targetDate: result.targetDate,
        monthlyContribution: result.monthlyContribution,
        autoTrack: result.autoTrack,
        category: result.category,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      return NextResponse.json(
        { success: true, goal },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in PUT /api/savings-goals:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update savings goal' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * DELETE /api/savings-goals?id=xxx
 * Delete a savings goal by id (query param).
 */
export async function DELETE(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id || typeof id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Goal id is required' },
          { status: 400, headers: corsHeaders() }
        );
      }

      let objectId: ObjectId;
      try {
        objectId = new ObjectId(id);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid goal id' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const result = await col.deleteOne({
        _id: objectId,
        userId: user.userId,
      });

      return NextResponse.json(
        { success: true, deletedCount: result.deletedCount },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in DELETE /api/savings-goals:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete savings goal' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}
