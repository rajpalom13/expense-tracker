/**
 * Budget Categories CRUD API
 * Manages user-customizable budget categories stored in MongoDB (budget_categories collection).
 *
 * GET    - List all categories for the user (seeds defaults on first access)
 * POST   - Create a new category
 * PUT    - Update an existing category (rename, change amount, update mapped transaction categories)
 * DELETE - Remove a category
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { withAuth, corsHeaders, handleOptions } from '@/lib/middleware';
import { getMongoDb } from '@/lib/mongodb';
import { buildSeedDocs } from '@/lib/budget-mapping';

const COLLECTION = 'budget_categories';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/budget-categories
 * Returns the user's budget categories. Seeds defaults on first access.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      let docs = await col.find({ userId: user.userId }).toArray();

      // First-time user: seed from defaults
      if (docs.length === 0) {
        const seeds = buildSeedDocs(user.userId);
        await col.insertMany(seeds);
        docs = await col.find({ userId: user.userId }).toArray();
      }

      const categories = docs.map((d) => ({
        id: d._id.toString(),
        name: d.name,
        transactionCategories: d.transactionCategories,
        description: d.description,
        budgetAmount: d.budgetAmount,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));

      return NextResponse.json(
        { success: true, categories },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in GET /api/budget-categories:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load budget categories' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * POST /api/budget-categories
 * Create a new budget category.
 * Body: { name, transactionCategories?, description?, budgetAmount? }
 */
export async function POST(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const { name, transactionCategories, description, budgetAmount } = body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Category name is required' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const trimmedName = name.trim();

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      // Check for duplicate name
      const existing = await col.findOne({ userId: user.userId, name: trimmedName });
      if (existing) {
        return NextResponse.json(
          { success: false, error: `Category "${trimmedName}" already exists` },
          { status: 409, headers: corsHeaders() }
        );
      }

      const now = new Date().toISOString();
      const doc = {
        userId: user.userId,
        name: trimmedName,
        transactionCategories: Array.isArray(transactionCategories) ? transactionCategories : [],
        description: typeof description === 'string' ? description : '',
        budgetAmount: typeof budgetAmount === 'number' && budgetAmount >= 0 ? budgetAmount : 0,
        createdAt: now,
        updatedAt: now,
      };

      const result = await col.insertOne(doc);

      return NextResponse.json(
        {
          success: true,
          category: {
            id: result.insertedId.toString(),
            ...doc,
          },
        },
        { status: 201, headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in POST /api/budget-categories:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create budget category' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * PUT /api/budget-categories
 * Update an existing budget category.
 * Body: { id, name?, transactionCategories?, description?, budgetAmount? }
 */
export async function PUT(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const { id, name, transactionCategories, description, budgetAmount } = body;

      if (!id || typeof id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Category id is required' },
          { status: 400, headers: corsHeaders() }
        );
      }

      let objectId: ObjectId;
      try {
        objectId = new ObjectId(id);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid category id' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const existing = await col.findOne({ _id: objectId, userId: user.userId });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404, headers: corsHeaders() }
        );
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (typeof name === 'string' && name.trim().length > 0) {
        const trimmedName = name.trim();
        // Check for duplicate name (different doc)
        if (trimmedName !== existing.name) {
          const dup = await col.findOne({ userId: user.userId, name: trimmedName });
          if (dup) {
            return NextResponse.json(
              { success: false, error: `Category "${trimmedName}" already exists` },
              { status: 409, headers: corsHeaders() }
            );
          }
        }
        updates.name = trimmedName;
      }

      if (Array.isArray(transactionCategories)) {
        updates.transactionCategories = transactionCategories;
      }

      if (typeof description === 'string') {
        updates.description = description;
      }

      if (typeof budgetAmount === 'number' && budgetAmount >= 0) {
        updates.budgetAmount = budgetAmount;
      }

      await col.updateOne({ _id: objectId }, { $set: updates });

      const updated = await col.findOne({ _id: objectId });

      return NextResponse.json(
        {
          success: true,
          category: {
            id: updated!._id.toString(),
            name: updated!.name,
            transactionCategories: updated!.transactionCategories,
            description: updated!.description,
            budgetAmount: updated!.budgetAmount,
            createdAt: updated!.createdAt,
            updatedAt: updated!.updatedAt,
          },
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in PUT /api/budget-categories:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update budget category' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

/**
 * DELETE /api/budget-categories?id=xxx
 * Remove a budget category.
 */
export async function DELETE(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id || typeof id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Category id is required' },
          { status: 400, headers: corsHeaders() }
        );
      }

      let objectId: ObjectId;
      try {
        objectId = new ObjectId(id);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid category id' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const result = await col.deleteOne({ _id: objectId, userId: user.userId });

      if (result.deletedCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404, headers: corsHeaders() }
        );
      }

      return NextResponse.json(
        { success: true, message: 'Category deleted' },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('Error in DELETE /api/budget-categories:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete budget category' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}
