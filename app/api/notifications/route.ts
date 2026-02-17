/**
 * Notifications API
 *
 * GET    - Fetch notifications (optionally filter by ?unread=true), sorted desc, limit 50
 * PATCH  - Mark notification(s) as read. Body: { ids: string[] } or { markAllRead: true }
 * DELETE - Delete notification by query param ?id=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { withAuth, corsHeaders, handleOptions, isValidObjectId } from '@/lib/middleware';

const COLLECTION = 'notifications';

// ─── GET ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const { searchParams } = new URL(req.url);
      const unreadOnly = searchParams.get('unread') === 'true';

      const db = await getMongoDb();
      const filter: Record<string, unknown> = { userId: user.userId };
      if (unreadOnly) filter.read = false;

      const notifications = await db
        .collection(COLLECTION)
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      const mapped = notifications.map((n) => ({
        ...n,
        _id: n._id.toString(),
      }));

      return NextResponse.json(
        { success: true, notifications: mapped },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('GET /api/notifications error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to load notifications' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

// ─── PATCH ───────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json();
      const db = await getMongoDb();

      if (body.markAllRead === true) {
        const result = await db
          .collection(COLLECTION)
          .updateMany(
            { userId: user.userId, read: false },
            { $set: { read: true } }
          );
        return NextResponse.json(
          { success: true, modified: result.modifiedCount },
          { headers: corsHeaders() }
        );
      }

      if (Array.isArray(body.ids) && body.ids.length > 0) {
        const objectIds = body.ids
          .filter((id: string) => isValidObjectId(id))
          .map((id: string) => new ObjectId(id));

        if (objectIds.length === 0) {
          return NextResponse.json(
            { success: false, message: 'No valid ids provided' },
            { status: 400, headers: corsHeaders() }
          );
        }

        const result = await db
          .collection(COLLECTION)
          .updateMany(
            { _id: { $in: objectIds }, userId: user.userId },
            { $set: { read: true } }
          );
        return NextResponse.json(
          { success: true, modified: result.modifiedCount },
          { headers: corsHeaders() }
        );
      }

      return NextResponse.json(
        { success: false, message: 'Provide { ids: [...] } or { markAllRead: true }' },
        { status: 400, headers: corsHeaders() }
      );
    } catch (error) {
      console.error('PATCH /api/notifications error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update notifications' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

// ─── DELETE ──────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id || !isValidObjectId(id)) {
        return NextResponse.json(
          { success: false, message: 'Missing or invalid notification id' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const db = await getMongoDb();
      const result = await db
        .collection(COLLECTION)
        .deleteOne({ _id: new ObjectId(id), userId: user.userId });

      return NextResponse.json(
        { success: true, deleted: result.deletedCount > 0 },
        { headers: corsHeaders() }
      );
    } catch (error) {
      console.error('DELETE /api/notifications error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to delete notification' },
        { status: 500, headers: corsHeaders() }
      );
    }
  })(request);
}

// ─── OPTIONS ─────────────────────────────────────────────────────────

export async function OPTIONS() {
  return handleOptions();
}
