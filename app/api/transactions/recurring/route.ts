import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"

import { getMongoDb } from "@/lib/mongodb"
import { corsHeaders, handleOptions, withAuth } from "@/lib/middleware"
import { detectRecurringTransactions } from "@/lib/recurring-detector"
import type { Transaction } from "@/lib/types"

/**
 * GET /api/transactions/recurring
 *
 * Detects recurring transaction patterns with confidence scoring.
 * Optional query params:
 *   - upcoming (number): only return patterns with next expected date within N days
 */
export async function GET(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const upcomingDays = searchParams.get("upcoming")
        ? parseInt(searchParams.get("upcoming")!, 10)
        : null

      const db = await getMongoDb()
      const col = db.collection("transactions")

      const docs = await col
        .find({ userId: user.userId })
        .sort({ date: -1 })
        .toArray()

      // Map MongoDB docs to Transaction shape
      const transactions: Transaction[] = docs.map((doc) => ({
        id: doc.txnId || (doc._id as ObjectId).toString(),
        date: new Date(doc.date as string),
        description: (doc.description as string) || "",
        merchant: (doc.merchant as string) || "",
        category: doc.category,
        amount: doc.amount as number,
        type: doc.type,
        paymentMethod: doc.paymentMethod,
        account: doc.account || "",
        status: doc.status || "completed",
        tags: doc.tags || [],
        recurring: doc.recurring || false,
        balance: doc.balance,
        sequence: doc.sequence,
      }))

      let patterns = detectRecurringTransactions(transactions)

      // Filter to upcoming patterns if requested
      if (upcomingDays !== null && !isNaN(upcomingDays)) {
        const now = new Date()
        const cutoff = new Date(now.getTime() + upcomingDays * 86_400_000)
        patterns = patterns.filter(
          (p) => new Date(p.nextExpectedDate) <= cutoff
        )
      }

      // Calculate upcoming total (next 7 days)
      const now = new Date()
      const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000)
      const upcomingPatterns = patterns.filter(
        (p) => {
          const next = new Date(p.nextExpectedDate)
          return next >= now && next <= sevenDaysOut
        }
      )
      const upcomingTotal = upcomingPatterns.reduce(
        (sum, p) => sum + p.averageAmount,
        0
      )

      return NextResponse.json(
        {
          success: true,
          patterns,
          count: patterns.length,
          upcoming: {
            count: upcomingPatterns.length,
            total: Math.round(upcomingTotal * 100) / 100,
            patterns: upcomingPatterns,
          },
          analyzedTransactions: transactions.length,
        },
        { status: 200, headers: corsHeaders() }
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("Recurring detection error:", message)
      return NextResponse.json(
        { success: false, message: "Failed to detect recurring transactions." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

export async function OPTIONS() {
  return handleOptions()
}
