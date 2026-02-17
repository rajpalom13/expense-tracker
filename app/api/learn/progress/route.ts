import { NextRequest, NextResponse } from 'next/server'
import { withAuth, corsHeaders, handleOptions } from '@/lib/middleware'
import { getMongoDb } from '@/lib/mongodb'

const COLLECTION = 'learn_progress'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/learn/progress
 * Fetch all progress records for the authenticated user.
 */
export const GET = withAuth(async (_req, { user }) => {
  try {
    const db = await getMongoDb()
    const docs = await db
      .collection(COLLECTION)
      .find({ userId: user.userId })
      .toArray()

    const progress = docs.map((d) => ({
      topicId: d.topicId,
      status: d.status,
      quizScore: d.quizScore,
      readAt: d.readAt,
      quizzedAt: d.quizzedAt,
    }))

    return NextResponse.json(
      { success: true, progress },
      { headers: corsHeaders() }
    )
  } catch (error) {
    console.error('[Learn Progress GET]', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch progress' },
      { status: 500, headers: corsHeaders() }
    )
  }
})

/**
 * POST /api/learn/progress
 * Update progress for a single topic.
 * Body: { topicId: string, status: 'unread' | 'read' | 'quizzed' | 'mastered', quizScore?: number }
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const { topicId, status, quizScore } = body

    if (!topicId || !status) {
      return NextResponse.json(
        { success: false, message: 'topicId and status are required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const validStatuses = ['unread', 'read', 'quizzed', 'mastered']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const db = await getMongoDb()
    const now = new Date().toISOString()

    const update: Record<string, unknown> = {
      userId: user.userId,
      topicId,
      status,
      updatedAt: now,
    }

    if (status === 'read') {
      update.readAt = now
    }
    if (status === 'quizzed' || status === 'mastered') {
      update.quizzedAt = now
      if (quizScore !== undefined) {
        update.quizScore = quizScore
      }
    }

    await db.collection(COLLECTION).updateOne(
      { userId: user.userId, topicId },
      { $set: update },
      { upsert: true }
    )

    return NextResponse.json(
      { success: true, topicId, status },
      { headers: corsHeaders() }
    )
  } catch (error) {
    console.error('[Learn Progress POST]', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update progress' },
      { status: 500, headers: corsHeaders() }
    )
  }
})
