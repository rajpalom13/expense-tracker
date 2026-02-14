// Google Sheets sync API route — now persists to MongoDB on sync
import { NextRequest, NextResponse } from "next/server"

import {
  fetchTransactionsFromSheet,
  getCachedTransactions,
  clearCache,
} from "@/lib/sheets"
import { getMongoDb } from "@/lib/mongodb"
import { corsHeaders, handleOptions, withAuth } from "@/lib/middleware"
import { TransactionCategory } from "@/lib/types"
import type { Transaction } from "@/lib/types"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}

/**
 * Persist transactions to MongoDB, applying user's categorization rules.
 * Transactions that already have a categoryOverride are not re-categorized.
 */
async function persistToMongo(userId: string, transactions: Transaction[]) {
  if (!transactions.length) return 0

  const db = await getMongoDb()
  const col = db.collection("transactions")

  // Load user rules
  const rules = await db
    .collection("categorization_rules")
    .find({ userId, enabled: true })
    .toArray()

  // Load existing transactions that have been manually overridden
  const existingOverrides = new Set<string>()
  const overrideDocs = await col
    .find({ userId, categoryOverride: true }, { projection: { txnId: 1 } })
    .toArray()
  overrideDocs.forEach((doc) => {
    if (doc.txnId) existingOverrides.add(doc.txnId as string)
  })

  const ops = transactions.map((txn) => {
    // Only apply auto-categorization + rules if NOT manually overridden
    let category = txn.category
    if (!existingOverrides.has(txn.id)) {
      for (const rule of rules) {
        const pattern = rule.pattern as string
        const matchField = rule.matchField as string
        const caseSensitive = rule.caseSensitive === true

        let textToSearch = ""
        if (matchField === "merchant") textToSearch = txn.merchant || ""
        else if (matchField === "description") textToSearch = txn.description || ""
        else textToSearch = `${txn.merchant || ""} ${txn.description || ""}`

        const haystack = caseSensitive ? textToSearch : textToSearch.toLowerCase()
        const needle = caseSensitive ? pattern : pattern.toLowerCase()

        if (haystack.includes(needle)) {
          category = rule.category as TransactionCategory
          break
        }
      }
    }

    const dateStr = txn.date instanceof Date ? txn.date.toISOString() : String(txn.date)

    // For overridden transactions, only update non-category fields
    if (existingOverrides.has(txn.id)) {
      return {
        updateOne: {
          filter: { userId, txnId: txn.id },
          update: {
            $set: {
              date: dateStr,
              description: txn.description,
              merchant: txn.merchant,
              amount: txn.amount,
              type: txn.type,
              paymentMethod: txn.paymentMethod,
              account: txn.account,
              status: txn.status,
              tags: txn.tags,
              recurring: txn.recurring,
              balance: txn.balance,
              updatedAt: new Date().toISOString(),
            },
          },
          upsert: false,
        },
      }
    }

    return {
      updateOne: {
        filter: { userId, txnId: txn.id },
        update: {
          $set: {
            userId,
            txnId: txn.id,
            date: dateStr,
            description: txn.description,
            merchant: txn.merchant,
            category,
            amount: txn.amount,
            type: txn.type,
            paymentMethod: txn.paymentMethod,
            account: txn.account,
            status: txn.status,
            tags: txn.tags,
            recurring: txn.recurring,
            balance: txn.balance,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            createdAt: new Date().toISOString(),
          },
        },
        upsert: true,
      },
    }
  })

  const result = await col.bulkWrite(ops, { ordered: false })
  return result.upsertedCount + result.modifiedCount
}

/**
 * GET /api/sheets/sync
 * Fetch from Google Sheets and persist to MongoDB.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const force = searchParams.get("force") === "true"

      // Check if we have cached data and force refresh is not requested
      const cached = getCachedTransactions()
      if (!force && cached.transactions && cached.lastSync) {
        // Still persist to MongoDB in case it's empty
        const persisted = await persistToMongo(user.userId, cached.transactions)

        return NextResponse.json(
          {
            success: true,
            message: "Using cached data",
            transactions: cached.transactions,
            lastSync: cached.lastSync,
            count: cached.transactions.length,
            persisted,
            cached: true,
          },
          { status: 200, headers: corsHeaders() }
        )
      }

      // Clear cache if force refresh
      if (force) {
        clearCache()
      }

      // Fetch fresh data from Google Sheets
      const { transactions, lastSync } = await fetchTransactionsFromSheet()

      // Persist to MongoDB
      const persisted = await persistToMongo(user.userId, transactions)

      return NextResponse.json(
        {
          success: true,
          message: "Data synced successfully",
          transactions,
          lastSync,
          count: transactions.length,
          persisted,
          cached: false,
        },
        { status: 200, headers: corsHeaders() }
      )
    } catch (error: unknown) {
      console.error("Sheets sync error:", getErrorMessage(error))
      return NextResponse.json(
        {
          success: false,
          message: `Failed to sync data: ${getErrorMessage(error)}`,
        },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

/**
 * DELETE /api/sheets/sync
 * Clear the cached transaction data
 */
export async function DELETE(request: NextRequest) {
  return withAuth(async (_req, _context) => {
    try {
      clearCache()

      return NextResponse.json(
        {
          success: true,
          message: "Cache cleared successfully",
        },
        { status: 200, headers: corsHeaders() }
      )
    } catch (error: unknown) {
      console.error("Cache clear error:", getErrorMessage(error))
      return NextResponse.json(
        {
          success: false,
          message: "Failed to clear cache",
        },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

export async function OPTIONS() {
  return handleOptions()
}
