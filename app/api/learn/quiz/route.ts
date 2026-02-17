import { NextResponse } from 'next/server'
import { withAuth, corsHeaders, handleOptions } from '@/lib/middleware'
import { getMongoDb } from '@/lib/mongodb'
import { TOPIC_QUIZZES } from '@/lib/learn-content'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/learn/quiz
 * Submit quiz answers, calculate score, update progress.
 * Body: { topicId: string, answers: number[] }
 * Response: { score, total, passed, explanations }
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const { topicId, answers } = body

    if (!topicId || !Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, message: 'topicId and answers[] are required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const quiz = TOPIC_QUIZZES[topicId]
    if (!quiz || quiz.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No quiz found for this topic' },
        { status: 404, headers: corsHeaders() }
      )
    }

    // Score the quiz
    let score = 0
    const total = quiz.length
    const explanations = quiz.map((q, i) => {
      const userAnswer = answers[i] ?? -1
      const correct = userAnswer === q.correctIndex
      if (correct) score++
      return {
        question: q.question,
        correct,
        userAnswer,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      }
    })

    const percent = (score / total) * 100
    const passed = percent >= 80

    // Update progress in MongoDB
    const db = await getMongoDb()
    const now = new Date().toISOString()
    const status = passed ? 'mastered' : 'quizzed'

    await db.collection('learn_progress').updateOne(
      { userId: user.userId, topicId },
      {
        $set: {
          userId: user.userId,
          topicId,
          status,
          quizScore: score,
          quizzedAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          readAt: now,
        },
      },
      { upsert: true }
    )

    return NextResponse.json(
      {
        success: true,
        score,
        total,
        percent: Math.round(percent),
        passed,
        status,
        explanations,
      },
      { headers: corsHeaders() }
    )
  } catch (error) {
    console.error('[Learn Quiz POST]', error)
    return NextResponse.json(
      { success: false, message: 'Failed to submit quiz' },
      { status: 500, headers: corsHeaders() }
    )
  }
})
