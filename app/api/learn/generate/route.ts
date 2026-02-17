import { NextResponse } from 'next/server'
import { withAuth, corsHeaders, handleOptions } from '@/lib/middleware'
import { getMongoDb } from '@/lib/mongodb'
import { chatCompletion } from '@/lib/openrouter'
import { TOPICS_MAP, TOPIC_CONTENT } from '@/lib/learn-content'

const CACHE_COLLECTION = 'learn_content'
const CACHE_TTL_DAYS = 7

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/learn/generate
 * Generate AI-personalized lesson content for a topic.
 * Body: { topicId: string }
 * Caches in MongoDB with 7-day TTL.
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const { topicId } = body

    if (!topicId) {
      return NextResponse.json(
        { success: false, message: 'topicId is required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const topic = TOPICS_MAP.get(topicId)
    if (!topic) {
      return NextResponse.json(
        { success: false, message: 'Topic not found' },
        { status: 404, headers: corsHeaders() }
      )
    }

    const db = await getMongoDb()

    // Check cache
    const cached = await db.collection(CACHE_COLLECTION).findOne({
      userId: user.userId,
      topicId,
      createdAt: { $gte: new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString() },
    })

    if (cached) {
      return NextResponse.json(
        { success: true, content: cached.content, cached: true },
        { headers: corsHeaders() }
      )
    }

    // Gather user's financial context
    const [transactions, stocks, mutualFunds, sips, goals] = await Promise.all([
      db.collection('transactions').find({}).sort({ date: -1 }).limit(100).toArray(),
      db.collection('stocks').find({}).toArray(),
      db.collection('mutual_funds').find({}).toArray(),
      db.collection('sips').find({}).toArray(),
      db.collection('income_goals').find({}).toArray(),
    ])

    // Build financial summary
    const totalIncome = transactions
      .filter((t) => t.type === 'credit')
      .reduce((s, t) => s + (t.amount || 0), 0)
    const totalExpenses = transactions
      .filter((t) => t.type === 'debit')
      .reduce((s, t) => s + Math.abs(t.amount || 0), 0)
    const savingsRate = totalIncome > 0
      ? ((totalIncome - totalExpenses) / totalIncome * 100)
      : 0

    const totalStockValue = stocks.reduce(
      (s, st) => s + (st.shares || 0) * (st.currentPrice || st.averageCost || 0), 0
    )
    const totalMFValue = mutualFunds.reduce(
      (s, mf) => s + (mf.currentValue || mf.investedAmount || 0), 0
    )
    const totalSipMonthly = sips
      .filter((s) => s.status === 'active')
      .reduce((s, sip) => s + (sip.monthlyAmount || sip.amount || 0), 0)

    const financialContext = `
User Financial Summary (INR):
- Recent income: Rs.${totalIncome.toLocaleString('en-IN')}
- Recent expenses: Rs.${totalExpenses.toLocaleString('en-IN')}
- Savings rate: ${savingsRate.toFixed(1)}%
- Stock portfolio value: Rs.${totalStockValue.toLocaleString('en-IN')} (${stocks.length} stocks)
- Mutual fund value: Rs.${totalMFValue.toLocaleString('en-IN')} (${mutualFunds.length} funds)
- Active SIP total: Rs.${totalSipMonthly.toLocaleString('en-IN')}/month (${sips.filter(s => s.status === 'active').length} SIPs)
- Financial goals: ${goals.length > 0 ? goals.map(g => g.name || g.title).join(', ') : 'None set'}
`.trim()

    const baseContent = TOPIC_CONTENT[topicId] || ''

    const systemPrompt = `You are a friendly and knowledgeable Indian personal finance educator.
You are writing a personalized lesson for a user about "${topic.title}".
Use the user's actual financial data to make examples relevant and actionable.
All amounts should be in INR (use Rs. or ₹ symbol).
Use Indian financial context (Indian tax laws, Indian market, Indian instruments).
Write in markdown format. Keep it conversational and practical.
Do NOT use generic examples — use the user's actual numbers.
Keep the lesson to about 600-800 words. Include:
1. A personalized introduction referencing their financial situation
2. Key concepts explained with their numbers as examples
3. 2-3 specific, actionable recommendations based on their data
4. A motivating closing statement`

    const userMessage = `Here is the user's financial data:
${financialContext}

Here is the base lesson content to personalize:
${baseContent}

Please create a personalized version of this lesson using the user's actual financial numbers. Make it feel like a 1-on-1 advice session.`

    const content = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { maxTokens: 3000 }
    )

    // Cache the result
    await db.collection(CACHE_COLLECTION).updateOne(
      { userId: user.userId, topicId },
      {
        $set: {
          userId: user.userId,
          topicId,
          content,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json(
      { success: true, content, cached: false },
      { headers: corsHeaders() }
    )
  } catch (error) {
    console.error('[Learn Generate POST]', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate personalized content' },
      { status: 500, headers: corsHeaders() }
    )
  }
})
