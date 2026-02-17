import { NextRequest, NextResponse } from "next/server"

import { getMongoDb } from "@/lib/mongodb"
import { corsHeaders, handleOptions, withAuth } from "@/lib/middleware"

// Escape CSV field (handle commas, quotes, newlines)
const escapeCSV = (value: string): string => {
  if (!value) return ""
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * GET /api/reports/export
 *
 * Export transactions as CSV.
 * Query params:
 *   - from: YYYY-MM-DD start date
 *   - to: YYYY-MM-DD end date
 *   - category: filter by category
 *   - type: "income" | "expense"
 */
export async function GET(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const from = searchParams.get("from")
      const to = searchParams.get("to")
      const category = searchParams.get("category")
      const type = searchParams.get("type")

      const db = await getMongoDb()
      const col = db.collection("transactions")

      // Build query
      const query: Record<string, unknown> = { userId: user.userId }

      if (from || to) {
        const dateFilter: Record<string, string> = {}
        if (from) dateFilter.$gte = new Date(from).toISOString()
        if (to) {
          // Include the entire "to" day
          const endDate = new Date(to)
          endDate.setHours(23, 59, 59, 999)
          dateFilter.$lte = endDate.toISOString()
        }
        query.date = dateFilter
      }

      if (category) query.category = category
      if (type && (type === "income" || type === "expense")) query.type = type

      const docs = await col
        .find(query)
        .sort({ date: -1 })
        .toArray()

      // CSV header
      const headers = [
        "Date",
        "Description",
        "Merchant",
        "Category",
        "Amount",
        "Type",
        "Payment Method",
        "Account",
      ]

      // Build rows
      const rows = docs.map((doc) => {
        const date = new Date(doc.date as string).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: "Asia/Kolkata",
        })

        return [
          date,
          escapeCSV((doc.description as string) || ""),
          escapeCSV((doc.merchant as string) || ""),
          escapeCSV((doc.category as string) || ""),
          (doc.amount as number).toFixed(2),
          (doc.type as string) || "",
          escapeCSV((doc.paymentMethod as string) || ""),
          escapeCSV((doc.account as string) || ""),
        ].join(",")
      })

      const csv = [headers.join(","), ...rows].join("\n")

      // Generate filename with date range
      const fromStr = from || "all"
      const toStr = to || "now"
      const filename = `transactions_${fromStr}_${toStr}.csv`

      return new NextResponse(csv, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("Export error:", message)
      return NextResponse.json(
        { success: false, message: "Failed to export transactions." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

export async function OPTIONS() {
  return handleOptions()
}
