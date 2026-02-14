import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"

import { getMongoDb } from "@/lib/mongodb"
import { corsHeaders, handleOptions, isValidObjectId, withAuth } from "@/lib/middleware"

function toRuleResponse(doc: Record<string, unknown>) {
  return {
    ...doc,
    _id: (doc._id as ObjectId)?.toString?.() || doc._id,
  }
}

/**
 * GET /api/categorization-rules
 * Fetch all categorization rules for the authenticated user.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (_req, { user }) => {
    try {
      const db = await getMongoDb()
      const rules = await db
        .collection("categorization_rules")
        .find({ userId: user.userId })
        .sort({ createdAt: -1 })
        .toArray()

      return NextResponse.json(
        { success: true, rules: rules.map(toRuleResponse) },
        { status: 200, headers: corsHeaders() }
      )
    } catch {
      return NextResponse.json(
        { success: false, message: "Failed to load rules." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

/**
 * POST /api/categorization-rules
 * Create a new categorization rule.
 *
 * Body: { pattern: string, matchField: "description"|"merchant"|"any", category: string, caseSensitive?: boolean }
 *
 * `pattern` is matched as a substring (case-insensitive by default).
 * Example: pattern "GROWSY" + matchField "description" + category "Investment"
 *   => any transaction whose description contains "GROWSY" is categorized as Investment.
 */
export async function POST(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const body = await req.json()
      const pattern = typeof body.pattern === "string" ? body.pattern.trim() : ""
      const matchField = body.matchField === "merchant" ? "merchant" : body.matchField === "description" ? "description" : "any"
      const category = typeof body.category === "string" ? body.category.trim() : ""
      const caseSensitive = body.caseSensitive === true

      if (!pattern || !category) {
        return NextResponse.json(
          { success: false, message: "Pattern and category are required." },
          { status: 400, headers: corsHeaders() }
        )
      }

      const now = new Date().toISOString()
      const doc = {
        userId: user.userId,
        pattern,
        matchField,
        category,
        caseSensitive,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }

      const db = await getMongoDb()
      const result = await db.collection("categorization_rules").insertOne(doc)

      return NextResponse.json(
        { success: true, rule: { ...doc, _id: result.insertedId.toString() } },
        { status: 201, headers: corsHeaders() }
      )
    } catch {
      return NextResponse.json(
        { success: false, message: "Failed to create rule." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

/**
 * PUT /api/categorization-rules?id=...
 * Update an existing categorization rule.
 */
export async function PUT(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const { searchParams } = new URL(req.url)
      const id = searchParams.get("id")
      if (!id || !isValidObjectId(id)) {
        return NextResponse.json(
          { success: false, message: "Missing or invalid rule id." },
          { status: 400, headers: corsHeaders() }
        )
      }

      const body = await req.json()
      const updates: Record<string, unknown> = {}

      if (typeof body.pattern === "string" && body.pattern.trim()) updates.pattern = body.pattern.trim()
      if (body.matchField === "merchant" || body.matchField === "description" || body.matchField === "any") updates.matchField = body.matchField
      if (typeof body.category === "string" && body.category.trim()) updates.category = body.category.trim()
      if (typeof body.caseSensitive === "boolean") updates.caseSensitive = body.caseSensitive
      if (typeof body.enabled === "boolean") updates.enabled = body.enabled

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { success: false, message: "No valid fields to update." },
          { status: 400, headers: corsHeaders() }
        )
      }

      updates.updatedAt = new Date().toISOString()

      const db = await getMongoDb()
      const result = await db.collection("categorization_rules").updateOne(
        { _id: new ObjectId(id), userId: user.userId },
        { $set: updates }
      )

      if (result.matchedCount === 0) {
        return NextResponse.json(
          { success: false, message: "Rule not found." },
          { status: 404, headers: corsHeaders() }
        )
      }

      const updated = await db.collection("categorization_rules").findOne({ _id: new ObjectId(id) })
      return NextResponse.json(
        { success: true, rule: updated ? toRuleResponse(updated as Record<string, unknown>) : null },
        { status: 200, headers: corsHeaders() }
      )
    } catch {
      return NextResponse.json(
        { success: false, message: "Failed to update rule." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

/**
 * DELETE /api/categorization-rules?id=...
 * Delete a categorization rule.
 */
export async function DELETE(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const { searchParams } = new URL(req.url)
      const id = searchParams.get("id")
      if (!id || !isValidObjectId(id)) {
        return NextResponse.json(
          { success: false, message: "Missing or invalid rule id." },
          { status: 400, headers: corsHeaders() }
        )
      }

      const db = await getMongoDb()
      const result = await db.collection("categorization_rules").deleteOne({
        _id: new ObjectId(id),
        userId: user.userId,
      })

      return NextResponse.json(
        { success: true, deleted: result.deletedCount > 0 },
        { status: 200, headers: corsHeaders() }
      )
    } catch {
      return NextResponse.json(
        { success: false, message: "Failed to delete rule." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

export async function OPTIONS() {
  return handleOptions()
}
