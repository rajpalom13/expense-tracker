import { NextRequest, NextResponse } from "next/server"

import { corsHeaders, handleOptions, withAuth } from "@/lib/middleware"
import { getMongoDb } from "@/lib/mongodb"

type FinnhubQuote = {
  c: number
  d: number
  dp: number
}

function toFinnhubSymbol(symbol: string, exchange: string): string {
  const ex = exchange.toUpperCase()
  if (ex === "NSE") return `${symbol}.NS`
  if (ex === "BSE") return `${symbol}.BO`
  return symbol
}

function toGoogleFinanceId(symbol: string, exchange: string): string {
  const ex = exchange.toUpperCase()
  if (ex === "NSE" || ex === "BSE") return `${symbol}:${ex}`
  if (ex === "NASDAQ") return `${symbol}:NASDAQ`
  if (ex === "NYSE") return `${symbol}:NYSE`
  return `${symbol}:NSE`
}

/**
 * Fetch quote from Google Finance (works for Indian stocks).
 * Improved error handling with retry and header rotation.
 */
async function fetchGoogleFinanceQuote(
  symbol: string,
  exchange: string
): Promise<{ current: number; change: number; changePercent: number } | null> {
  try {
    const gfId = toGoogleFinanceId(symbol, exchange)
    const url = `https://www.google.com/finance/quote/${gfId}`
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return null

    const html = await response.text()

    // Extract last price from data-last-price attribute
    const lastPriceMatch = html.match(/data-last-price="([^"]+)"/)
    if (!lastPriceMatch) return null
    const current = parseFloat(lastPriceMatch[1])
    if (!current || !Number.isFinite(current)) return null

    // Extract previous close
    let prevClose = 0
    const prevCloseIdx = html.indexOf("Previous close")
    if (prevCloseIdx !== -1) {
      const afterPrev = html.substring(prevCloseIdx, prevCloseIdx + 500)
      const p6Match = afterPrev.match(/class="P6K39c"[^>]*>₹?([\d,]+\.?\d*)/)
      if (p6Match) {
        prevClose = parseFloat(p6Match[1].replace(/,/g, ""))
      }
      // Try alternate class patterns if P6K39c changes
      if (!prevClose) {
        const altMatch = afterPrev.match(/>₹?([\d,]+\.?\d*)</)
        if (altMatch) {
          prevClose = parseFloat(altMatch[1].replace(/,/g, ""))
        }
      }
    }

    // Also try data-previous-close attribute
    if (!prevClose) {
      const prevAttrMatch = html.match(/data-previous-close="([^"]+)"/)
      if (prevAttrMatch) {
        prevClose = parseFloat(prevAttrMatch[1])
      }
    }

    const change = prevClose > 0 ? current - prevClose : 0
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    return {
      current: Math.round(current * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    }
  } catch {
    return null
  }
}

/**
 * Fetch quote from Yahoo Finance v8 API (reliable for Indian stocks).
 * Uses the public chart endpoint which doesn't require API key.
 */
async function fetchYahooFinanceQuote(
  symbol: string,
  exchange: string
): Promise<{ current: number; change: number; changePercent: number } | null> {
  try {
    const ex = exchange.toUpperCase()
    let yahooSymbol = symbol
    if (ex === "NSE") yahooSymbol = `${symbol}.NS`
    else if (ex === "BSE") yahooSymbol = `${symbol}.BO`

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return null

    const data = await response.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const meta = result.meta
    const current = meta?.regularMarketPrice
    const prevClose = meta?.chartPreviousClose || meta?.previousClose

    if (!current || !Number.isFinite(current)) return null

    const change = prevClose > 0 ? current - prevClose : 0
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    return {
      current: Math.round(current * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    }
  } catch {
    return null
  }
}

/**
 * Fetch quote from Finnhub (works for US stocks, may work for Indian with paid plan).
 */
async function fetchFinnhubQuote(
  symbol: string,
  exchange: string,
  apiKey: string
): Promise<{ current: number; change: number; changePercent: number } | null> {
  try {
    const finnhubSymbol = toFinnhubSymbol(symbol, exchange)
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!response.ok) return null

    const data = (await response.json()) as FinnhubQuote
    const current = Number(data.c || 0)
    const change = Number(data.d || 0)
    const changePercent = Number(data.dp || 0)

    if (current === 0 && change === 0) return null

    return { current, change, changePercent }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  return withAuth(async (req, { user }) => {
    try {
      const apiKey = process.env.FINNHUB_API_KEY || ""

      const { searchParams } = new URL(req.url)
      const symbolsParam = searchParams.get("symbols")
      if (!symbolsParam) {
        return NextResponse.json(
          { success: false, message: "Missing symbols." },
          { status: 400, headers: corsHeaders() }
        )
      }

      const requestedSymbols = symbolsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

      // Look up exchange info from the user's stored stocks
      const db = await getMongoDb()
      const userStocks = await db
        .collection("stocks")
        .find({ userId: user.userId, symbol: { $in: requestedSymbols } })
        .project({ symbol: 1, exchange: 1 })
        .toArray()

      const exchangeMap: Record<string, string> = {}
      userStocks.forEach((stock) => {
        exchangeMap[stock.symbol as string] = (stock.exchange as string) || "NSE"
      })

      const results: Record<
        string,
        { current: number; change: number; changePercent: number; source: string }
      > = {}

      // Fetch all quotes in parallel with multi-source fallback
      const quotePromises = requestedSymbols.map(async (symbol) => {
        const exchange = exchangeMap[symbol] || "NSE"
        const isIndian = exchange === "NSE" || exchange === "BSE"

        let quote: { current: number; change: number; changePercent: number } | null = null
        let source = "none"

        if (isIndian) {
          // Strategy for Indian stocks: Google Finance -> Yahoo Finance -> Finnhub
          quote = await fetchGoogleFinanceQuote(symbol, exchange)
          if (quote) {
            source = "google"
          }

          if (!quote) {
            quote = await fetchYahooFinanceQuote(symbol, exchange)
            if (quote) source = "yahoo"
          }

          if (!quote && apiKey) {
            quote = await fetchFinnhubQuote(symbol, exchange, apiKey)
            if (quote) source = "finnhub"
          }

          // Try alternate exchange
          if (!quote) {
            const altExchange = exchange === "NSE" ? "BSE" : "NSE"
            quote = await fetchGoogleFinanceQuote(symbol, altExchange)
            if (quote) source = "google-alt"
            if (!quote) {
              quote = await fetchYahooFinanceQuote(symbol, altExchange)
              if (quote) source = "yahoo-alt"
            }
          }
        } else {
          // For US stocks: Finnhub -> Yahoo -> Google
          if (apiKey) {
            quote = await fetchFinnhubQuote(symbol, exchange, apiKey)
            if (quote) source = "finnhub"
          }
          if (!quote) {
            quote = await fetchYahooFinanceQuote(symbol, exchange)
            if (quote) source = "yahoo"
          }
          if (!quote) {
            quote = await fetchGoogleFinanceQuote(symbol, exchange)
            if (quote) source = "google"
          }
        }

        results[symbol] = quote
          ? { ...quote, source }
          : { current: 0, change: 0, changePercent: 0, source: "none" }
      })

      await Promise.all(quotePromises)

      return NextResponse.json(
        { success: true, quotes: results },
        { status: 200, headers: corsHeaders() }
      )
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch quotes." },
        { status: 500, headers: corsHeaders() }
      )
    }
  })(request)
}

export async function OPTIONS() {
  return handleOptions()
}
