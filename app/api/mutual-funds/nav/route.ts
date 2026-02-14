import { NextRequest, NextResponse } from "next/server"

import { corsHeaders, handleOptions, withAuth } from "@/lib/middleware"
import { getMongoDb } from "@/lib/mongodb"
import { fetchLatestNAV, searchSchemes, fetchNAVHistory, calculateTrailingReturns } from "@/lib/mfapi"

/**
 * GET /api/mutual-funds/nav?schemes=code1,code2
 * or  /api/mutual-funds/nav?search=scheme+name
 * or  /api/mutual-funds/nav?history=code
 *
 * Fetch latest NAVs from MFAPI.in and optionally update currentValue in MongoDB.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const { searchParams } = new URL(req.url)

      // Search mode
      const searchQuery = searchParams.get("search")
      if (searchQuery) {
        const results = await searchSchemes(searchQuery)
        return NextResponse.json(
          { success: true, results: results.slice(0, 20) },
          { status: 200, headers: corsHeaders() }
        )
      }

      // History mode with trailing returns
      const historyCode = searchParams.get("history")
      if (historyCode) {
        const code = parseInt(historyCode)
        if (isNaN(code)) {
          return NextResponse.json(
            { success: false, message: "Invalid scheme code." },
            { status: 400, headers: corsHeaders() }
          )
        }
        const history = await fetchNAVHistory(code)
        if (!history) {
          return NextResponse.json(
            { success: false, message: "Failed to fetch NAV history." },
            { status: 502, headers: corsHeaders() }
          )
        }
        const trailingReturns = calculateTrailingReturns(history)
        return NextResponse.json(
          {
            success: true,
            meta: history.meta,
            trailingReturns,
            latestNAV: history.data?.[0] ? parseFloat(history.data[0].nav) : null,
            latestDate: history.data?.[0]?.date || null,
            dataPoints: history.data?.length || 0,
          },
          { status: 200, headers: corsHeaders() }
        )
      }

      // Fetch latest NAVs mode
      const schemesParam = searchParams.get("schemes")
      if (!schemesParam) {
        return NextResponse.json(
          { success: false, message: "Provide ?schemes=code1,code2 or ?search=name or ?history=code" },
          { status: 400, headers: corsHeaders() }
        )
      }

      const schemeCodes = schemesParam
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n))

      if (!schemeCodes.length) {
        return NextResponse.json(
          { success: false, message: "No valid scheme codes." },
          { status: 400, headers: corsHeaders() }
        )
      }

      // Fetch all NAVs in parallel
      const navResults: Record<number, { schemeName: string; latestNAV: number; date: string }> = {}
      const navPromises = schemeCodes.map(async (code) => {
        const result = await fetchLatestNAV(code)
        if (result) {
          navResults[code] = {
            schemeName: result.schemeName,
            latestNAV: result.latestNAV,
            date: result.date,
          }
        }
      })
      await Promise.all(navPromises)

      // Auto-update currentValue in MongoDB if updateDb param is set
      const shouldUpdate = searchParams.get("updateDb") === "true"
      let updatedCount = 0

      if (shouldUpdate) {
        const db = await getMongoDb()
        const funds = await db
          .collection("mutual_funds")
          .find({ userId: user.userId })
          .toArray()

        const updatePromises = funds.map(async (fund) => {
          // Try to match by schemeCode field or by schemeName
          const schemeCode = fund.schemeCode as number | undefined
          let nav: number | null = null

          if (schemeCode && navResults[schemeCode]) {
            nav = navResults[schemeCode].latestNAV
          }

          if (nav && typeof fund.units === "number" && fund.units > 0) {
            const newCurrentValue = Math.round(nav * fund.units * 100) / 100
            await db.collection("mutual_funds").updateOne(
              { _id: fund._id },
              {
                $set: {
                  currentValue: newCurrentValue,
                  currentNAV: nav,
                  returns: newCurrentValue - (fund.investedValue as number || 0),
                  updatedAt: new Date().toISOString(),
                },
              }
            )
            updatedCount++
          }
        })
        await Promise.all(updatePromises)
      }

      return NextResponse.json(
        { success: true, navs: navResults, updatedCount },
        { status: 200, headers: corsHeaders() }
      )
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch NAV data." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

export async function OPTIONS() {
  return handleOptions()
}
