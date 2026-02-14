import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { corsHeaders, handleOptions, withAuth } from '@/lib/middleware';
import { getDefaultNWIConfig } from '@/lib/nwi';
import { TransactionCategory, NWIConfig } from '@/lib/types';

const COLLECTION = 'nwi_config';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      let doc = await col.findOne({ userId: user.userId });

      if (!doc) {
        const defaultConfig = getDefaultNWIConfig(user.userId);
        await col.insertOne(defaultConfig);
        doc = await col.findOne({ userId: user.userId });
      }

      return NextResponse.json(
        {
          success: true,
          config: {
            needs: doc!.needs,
            wants: doc!.wants,
            investments: doc!.investments,
          },
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in GET /api/nwi-config:', message);
      return NextResponse.json(
        { success: false, error: 'Failed to load NWI config' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

export async function PUT(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const { needs, wants, investments } = body as Partial<
        Pick<NWIConfig, 'needs' | 'wants' | 'investments'>
      >;

      // Validate percentages sum to 100 when all three are provided
      if (needs?.percentage != null && wants?.percentage != null && investments?.percentage != null) {
        const total = needs.percentage + wants.percentage + investments.percentage;
        if (total !== 100) {
          return NextResponse.json(
            { success: false, error: `Percentages must sum to 100 (got ${total})` },
            { status: 400, headers: corsHeaders() }
          );
        }
      }

      // Validate no duplicate categories across buckets
      const allCategories: TransactionCategory[] = [
        ...(needs?.categories ?? []),
        ...(wants?.categories ?? []),
        ...(investments?.categories ?? []),
      ];
      const seen = new Set<TransactionCategory>();
      for (const cat of allCategories) {
        if (seen.has(cat)) {
          return NextResponse.json(
            { success: false, error: `Duplicate category across buckets: ${cat}` },
            { status: 400, headers: corsHeaders() }
          );
        }
        seen.add(cat);
      }

      const db = await getMongoDb();
      const col = db.collection(COLLECTION);

      const updateFields: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (needs) updateFields.needs = needs;
      if (wants) updateFields.wants = wants;
      if (investments) updateFields.investments = investments;

      await col.updateOne(
        { userId: user.userId },
        { $set: updateFields }
      );

      const updatedDoc = await col.findOne({ userId: user.userId });

      return NextResponse.json(
        {
          success: true,
          config: {
            needs: updatedDoc!.needs,
            wants: updatedDoc!.wants,
            investments: updatedDoc!.investments,
          },
        },
        { headers: corsHeaders() }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in PUT /api/nwi-config:', message);
      return NextResponse.json(
        { success: false, error: 'Failed to update NWI config' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}
